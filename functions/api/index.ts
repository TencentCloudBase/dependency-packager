import { Callback, Context } from "aws-lambda";
import * as LRU from "lru-cache";
import * as tcb from "@cloudbase/node-sdk";

const VERSION = 2;

import parseDependencies from "./dependencies/parse-dependencies";

const currentEnv = tcb.SYMBOL_CURRENT_ENV;

//云函数下指定环境为当前的执行环境
const app = tcb.init({
  env: currentEnv,
});
const db = app.database({
  env: currentEnv,
});

const errorCache: LRU.Cache<string, string> = LRU({
  max: 1024,
  maxAge: 1000 * 5,
});

export interface ILambdaResponse {
  contents: {
    [path: string]: { content: string };
  };
  dependency: {
    name: string;
    version: string;
  };
  peerDependencies: {
    [dep: string]: string;
  };
  dependencyDependencies: {
    [dep: string]: {
      semver: string;
      resolved: string;
      parents: string[];
      entries: string[];
    };
  };
  dependencyAliases: {
    [dep: string]: {
      [dep: string]: string;
    };
  };
}

const defaultHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*", // Required for CORS support to work
  "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
};

const CACHE_TIME = 60 * 60 * 24; // A day caching

const { BUCKET_NAME } = process.env;

async function getFileFromStorage(keyPath: string): Promise<any> {
  try {
    return (await db.collection("code-sandbox-packager-db").doc(keyPath).get())
      .data[0];
  } catch (e) {
    console.log(`getFileFromStorage error`, keyPath, e);
    return null;
  }
}

async function generateDependency(
  name: string,
  version: string,
): Promise<{ error: string } | ILambdaResponse | null> {
  try {
    const res = await app.callFunction({
      name: "codesandbox-packager-v2-packager",
      data: {
        name,
        version,
      },
    });

    return res.result;
  } catch (error) {
    error.message = `Error while packaging ${name}@${version}: ${error.message}`;

    throw error;
  }
}

function getResponse(bundlePath: string) {
  const response = JSON.stringify({ url: bundlePath.replace(/\+/g, "%2B") });

  return {
    statusCode: 200,
    headers: {
      "Cache-Control": `public, max-age=${CACHE_TIME}`,
      "Content-Length": response.length,
      ...defaultHeaders,
    },
    body: response,
  };
}

export async function http(event: any, context: Context, cb: Callback) {
  try {
    /** Immediate response for WarmUP plugin */
    if (event.source === "serverless-plugin-warmup") {
      console.log("WarmUP - Lambda is warm!");
      return cb(undefined, "Lambda is warm!");
    }

    console.log(event, event.path);

    const packages = event.path.slice(1);
    const escapedPackages = decodeURIComponent(packages);
    const dependencies = await parseDependencies(escapedPackages);

    const receivedData: ILambdaResponse[] = [];

    console.log("Packaging '" + escapedPackages + "'");

    const depName = Object.keys(dependencies)[0];
    const bundlePath = `v${VERSION}/packages/${depName}/${dependencies[depName]}.json`;
    const bundle = await getFileFromStorage(bundlePath);

    console.log(bundle);

    if (bundle) {
      cb(undefined, getResponse(bundlePath));
      return;
    }

    await Promise.all(
      Object.keys(dependencies).map(async (depName) => {
        const depPath = `v${VERSION}/packages/${depName}/${dependencies[depName]}.json`;
        const result = await getFileFromStorage(depPath);

        if (result) {
          receivedData.push(result);
        } else {
          const key = depName + dependencies[depName];

          const error = errorCache.get(key);

          if (error) {
            errorCache.del(key);

            throw new Error(error);
          }

          const data = await generateDependency(depName, dependencies[depName]);

          if (data === null) {
            throw new Error(
              "An unknown error happened while packaging the dependency " +
                depName +
                "@" +
                dependencies[depName],
            );
          } else if ("error" in data) {
            // The request probably expired already, so we set a cache that can be returned when the next request comes in

            const message =
              "Something went wrong while packaging the dependency " +
              depName +
              "@" +
              dependencies[depName] +
              ": " +
              data.error;
            errorCache.set(key, message);
            throw new Error(message);
          } else {
            receivedData.push(data);
          }
        }

        if (receivedData.length === Object.keys(dependencies).length) {
          cb(undefined, getResponse(bundlePath));
        }
      }),
    );
  } catch (e) {
    console.error("ERROR ", e);

    const statusCode = e.code && e.code === "E404" ? 404 : 500;

    cb(undefined, {
      statusCode,
      body: JSON.stringify({ error: e.message }),
      headers: defaultHeaders,
    });
  }
}
