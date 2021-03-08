import * as npa from "npm-package-arg";
import * as pacote from "pacote";

/**
 * Gets the absolute versions of all dependencies
 *
 * @param {IDependencies} dependencies
 * @returns
 */
async function getAbsoluteVersions(dependencies: IDependencies) {
  const dependencyNames = Object.keys(dependencies);

  // First build an array with name and absolute version, allows parallel
  // fetching of version numbers
  const absoluteDependencies = await Promise.all(
    dependencyNames.map(async (depName) => {
      const depString = `${depName}@${dependencies[depName]}`;

      const spec = npa(depString);

      if (spec.type === "git") {
        return { name: depName, version: dependencies[depName] };
      }

      try {
        const manifest = await pacote.manifest(depString, {
          registry: "https://registry.npm.taobao.org",
        });

        const absoluteVersion = manifest.version;

        return { name: depName, version: absoluteVersion };
      } catch (e) {
        e.message = `Could not fetch version for ${depString}: ${e.message}`;
        throw e;
      }
    }),
  );

  return absoluteDependencies.reduce((total: IDependencies, next) => {
    total[next.name] = next.version;
    return total;
  }, {});
}

/**
 * This filters all dependencies that are not needed for CodeSandbox and normalizes
 * the versions from semantic to absolute version, eg: ^1.0.0 -> 1.2.1
 *
 * @export
 * @param {object} dependencies
 */
export default async function mapDependencies(dependencies: IDependencies) {
  const absoluteDependencies = await getAbsoluteVersions(dependencies);

  return absoluteDependencies;
}
