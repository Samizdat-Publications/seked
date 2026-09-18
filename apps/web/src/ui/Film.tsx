/**
 * The Film drawer. The trunk's stub says what is coming; Track O replaces it
 * with the sequence picker, the size, the rate and the Record button that
 * steps the motion clock frame by frame into an mp4.
 */
export function Film(): React.JSX.Element {
  return (
    <section className="block">
      <p className="note">
        Recording a film from the viewer is stage 4's work in progress: a sequence stepped one frame at a time at the size you ask
        for, written to an mp4 or to frames.
      </p>
    </section>
  );
}
