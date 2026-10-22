/** CSS Modules resolve to a class-name record in this package's client program. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
