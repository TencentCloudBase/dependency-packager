import mapDependencies from "./utils/dependency-mapper";

export default async function parseDependencies(
  url: string,
): Promise<{ [depName: string]: string }> {
  console.log(url);
  const parsedDependencies = url
    .split("+")
    .map((dep) => {
      const parts = dep.split("@");
      const version = parts.pop();

      return {
        name: parts.join("@"),
        version,
      };
    })
    .reduce((total, next) => ({ ...total, [next.name]: next.version }), {});
  console.log(mapDependencies);

  return mapDependencies(parsedDependencies);
}
