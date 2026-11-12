"""Compile the FLN engine and package the same HTML for Pages and offline play."""

import re
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


PROJECT = Path(__file__).resolve().parent
WEB = PROJECT / "src" / "main" / "web"
ENGINE = PROJECT / "target" / "scala-2.13" / "colonial-twilight-fln-web-opt" / "main.js"
OUTPUT = PROJECT.parents[1] / "games" / "colonial-twilight"
EXPORT = re.compile(r"^export \{ ([\w$]+) as (\w+) \};\n?", re.MULTILINE)


def inline_engine(source):
    exports = EXPORT.findall(source)
    if sorted(name for _, name in exports) != ["answerPrompt", "listCards", "openGame"]:
        raise ValueError("Unexpected Scala.js exports")
    members = ", ".join(f"{name}: {symbol}" for symbol, name in exports)
    return "function createEngine() {\n" + EXPORT.sub("", source) + f"\nreturn {{ {members} }};\n}}\n"


def build():
    sbt = shutil.which("sbt")
    if sbt is None:
        raise SystemExit("Install sbt and make it available on PATH.")
    subprocess.run([sbt, "fullLinkJS"], cwd=PROJECT, check=True)

    scripts = [inline_engine(ENGINE.read_text(encoding="utf-8"))]
    scripts.extend((WEB / name).read_text(encoding="utf-8") for name in ("saves.js", "app.js"))
    script = "(function () {\n'use strict';\n" + "\n".join(scripts) + "\n})();"
    script = re.sub(r"</script", lambda match: r"<\/" + match[0][2:], script, flags=re.IGNORECASE)
    page = (WEB / "index.html").read_text(encoding="utf-8")
    page = page.replace("<!-- COMPANION_STYLE -->\n", (WEB / "style.css").read_text(encoding="utf-8"))
    page = page.replace("<!-- COMPANION_SCRIPT -->", script).encode("utf-8")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=OUTPUT) as staging:
        html = Path(staging) / "index.html"
        archive = Path(staging) / "Colonial_Twilight_FLN.zip"
        html.write_bytes(page)
        entry = ZipInfo("Colonial_Twilight_FLN.html", date_time=(1980, 1, 1, 0, 0, 0))
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        with ZipFile(archive, "w") as output:
            output.writestr(entry, page, compress_type=ZIP_DEFLATED, compresslevel=9)
        html.replace(OUTPUT / html.name)
        archive.replace(OUTPUT / archive.name)
    print(f"Built {OUTPUT / 'index.html'} and {OUTPUT / 'Colonial_Twilight_FLN.zip'}")


if __name__ == "__main__":
    build()
