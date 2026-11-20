# Solo Table

Solo Table hosts browser companions for physical board games, including *A Glorious Chance*, *Colonial Twilight*, *Labyrinth*, *Fire in the Lake*, *Cuba Libre*, *Liberty or Death*, *All Bridges Burning*, *Pendragon*, *Kutná Hora*, and *Dominant Species*.

## Play

Open the [Solo Table catalog](https://solo-table.pages.dev/) and choose **Play in browser**. For offline play, choose the companion's download and open its HTML file in your browser. Extract ZIP downloads first.

[A Glorious Chance v0.2.18](https://solo-table.pages.dev/games/a-glorious-chance/) requires the physical game and Event deck. The app runs the opposing squadron in either campaign, and asks for each physical Event card number. [Source, tests and audit evidence](https://github.com/ramyahoo88/A_Glorious_Chance_solo).

Cloudflare publication retains every previously published companion and download through the current production asset manifest. Cloudflare Pages uses direct uploads to the existing `solo-table` project; `_headers` preserves download filenames. Compare the latest production file manifest before preparing a new upload, so another release is retained.

The Colonial Twilight companion’s **Saved games** controls move a game between browsers or between the hosted and offline copies. [Colonial Twilight source and build instructions](source/colonial-twilight/README.md)

## Add a companion

1. Put the app at `games/<slug>/index.html` and keep any app assets within that game’s folder. Use relative paths.
2. Add an `article` to the catalog in `index.html`, with a launch link to the new app. Include a download link for a self-contained offline build.
3. Add any cover art you can redistribute to `assets/` and give the image a descriptive `alt` attribute when it provides context.
4. Test the launch and download from the catalog, then commit the files to `main`.

## Publish with GitHub Pages

In the repository’s **Settings → Pages**, select **Deploy from a branch**, then `main` and `/ (root)`. Keep `.nojekyll` in the repository root to serve the files as written. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Credits

*Colonial Twilight* was designed by Brian Train and published by GMT Games. VPJ Arponen designed the FLN bot. The browser companion uses Curt Sellmer’s MIT-licensed FLN bot software, with its license included in the app. [Upstream bot software](https://github.com/sellmerfud/coltwi/tree/v2.16)

The catalog cover is an original illustration of Algiers. Instrument Serif and DM Sans are included under the SIL Open Font License. Their license notices are in `assets/`.
