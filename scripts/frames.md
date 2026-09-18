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
3. Put the view where the measure belongs: `__seked.view.getState()` to set
   the state, and a look's own `camera` and `moment` out of `__seked.looks`,
   exactly as the Views drawer sets them (`setMode('orbit')`, `showCamera`,
   `setMoment`).
4. Wait for `__seked.view.getState().loading.size === 0` and then two seconds
   more, so the sky rebuild, the shadow cascades and the level swaps have all
   settled and the count is of a steady frame and not of a load.
5. `await __seked.frames(2)`: `requestAnimationFrame` counted over two seconds
   from the first callback, divided by the seconds that actually passed
   (`apps/web/src/scene/frames.ts`). Take three and quote the median.
6. `__seked.r3f().getState().gl.info` beside it, for `render.calls` and
   `render.triangles`, which say whether a change moved geometry or shading.
