# How a frame rate in this repo was taken

Every rate quoted in a track Q commit was taken this way and no other way.

1. `pnpm bundle && python scripts/web-textures.py && pnpm web-assets`, then
   `pnpm --filter @seked/web dev -- --port 5181 --strictPort`.
2. One Chromium tab at 1600 by 900, the window visible and in front, nothing
   else drawing on the GPU. A hidden tab is throttled and `countFrames`
   refuses to report one, so a minimised or fully covered window gives no
   number at all rather than a wrong one.

   This is the step that goes wrong. A browser shared with another session,
   which is what the session's own browser tools hand you when two tracks are
   running at once, is a browser with another plateau drawing in it: it halves
   every number, and it reloads the page and moves the camera in the middle of
   a count. Two of track Q's own tables had to be taken again for that reason
   (2026-09-18). Use a browser nobody else has the address of.

   **And nothing else on the machine, this repo's own jobs included.** The
   table in b3c519d was taken while `pnpm run deploy` was building the site in
   a detached job, and every number in it is about half what the same tree
   gives on a quiet machine: `built` at dawn 62 against 122, `ancient` at
   harbour 48 against 96. It read exactly like a regression and was reported
   as one. `python scripts/job.py status` before measuring, and again after,
   because a job that started in the middle is a table that has to be thrown
   away.

   **The count cannot go past the display's refresh.** `requestAnimationFrame`
   fires on the vertical blank, so a scene faster than the screen reports the
   screen. This machine's is 240 Hz, and a stand that comes back 239 or 240
   has not been measured at all, it has only been shown to be faster than the
   monitor: every `today` stand does that now. Quote those as "at the 240 Hz
   cap", never as a rate, and compare only numbers under it.
   **Quote the drawing buffer with every number, never the window.** The
   renderer draws at the window's CSS size times the device's pixel ratio, and
   this machine's is 1.5, so "1600 by 900" has meant both a 1600 by 900 buffer
   and a 2400 by 1350 one in this repo's own commit messages: 2.25 times the
   pixels, and numbers that cannot be compared: the ring commit 68e6495 quotes
   `today` at 97 to 145 and says in the same breath that it is a 2400 by 1350
   buffer, while the 237 to 240 in the stage 5 notes is the same tree at 1601
   by 900. `gl.domElement.width` and `.height` are the number to print. To get the
   1601 by 900 the stage 6 tables were taken at, size the window to 1067 by 600
   and let the ratio do the rest; a reload resets it, so set it again after one.

3. Put the view where the measure belongs: `__seked.view.getState()` to set
   the state, and a look's own `camera` and `moment` out of `__seked.looks`,
   exactly as the Views drawer sets them (`setMode('orbit')`, `showCamera`,
   `setMoment`).
4. Wait for `__seked.view.getState().loading.size === 0` and then **five**
   seconds more, so the sky rebuild, the shadow cascades and the level swaps
   have all settled and the count is of a steady frame and not of a load. Two
   seconds is not enough after a change of state: `built` at dawn counted 13,
   13 and 31 on a two-second settle and 60, 56, 54, 58 on a six-second one
   (2026-09-19). A first count far under the ones after it is this, not the
   scene.
5. `await __seked.frames(2)`: `requestAnimationFrame` counted over two seconds
   from the first callback, divided by the seconds that actually passed
   (`apps/web/src/scene/frames.ts`). Take three and quote the median.
6. `__seked.r3f().getState().gl.info` beside it, for `render.calls` and
   `render.triangles`, which say whether a change moved geometry or shading.
