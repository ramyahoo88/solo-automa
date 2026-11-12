# Colonial Twilight FLN companion source

The browser engine adapts Curt Sellmer’s *coltwi* v2.16 at commit `2490959cb34e6ade7722ab69e13f33c88d540cde`. The engine and browser adapter are in `src/main/scala/coltwi`. The interface, styles, and save format are in `src/main/web`. [Upstream source](https://github.com/sellmerfud/coltwi/tree/2490959cb34e6ade7722ab69e13f33c88d540cde) · [MIT license](LICENSE)

## Build and test

From this directory, run the build with a JDK, sbt, and Python 3 on `PATH`. Run the tests with Node.js 22 or later.

```sh
python3 build.py
node --test
```

The build uses the Scala and Scala.js versions pinned in this project. It writes `games/colonial-twilight/index.html` and `Colonial_Twilight_FLN.zip` from the same HTML bytes. Commit both generated files with changes to the source. The ZIP contains `Colonial_Twilight_FLN.html` for opening directly in a browser.

## Saved games

The **Saved games** controls export or import a JSON file on both the site and the offline app. The app opens earlier browser saves in place and adds save-format and engine versions after a successful replay. It keeps a recovery copy of a damaged browser save when a new game takes its place. The recovery copy retains the saved data exactly as it was read.

The engine reconstructs the game from the scenario, seed, options, and answers. If a future engine changes how those answers replay, update the engine version in `src/main/web/saves.js` and retain compatibility for any supported older versions.
