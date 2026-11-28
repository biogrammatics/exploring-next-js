/**
 * Site-wide decorative background video.
 *
 * Replaces the rotating CSS gradients as the primary background. The gradients
 * stay mounted underneath (see `.gradient-bg` in globals.css) as the final
 * fallback.
 *
 * ## Why there is a poster layer
 *
 * The video cannot paint until its first frame decodes, and until then
 * whatever sits behind it shows through. With only the gradients back there,
 * a cold load flashed bright purple before cutting to the dark video.
 *
 * So the wrapper paints the backdrop itself, in two stages that both land
 * before the video does:
 *
 *   1. `background-color: #021b20` — the measured mean colour of all 600
 *      frames of the loop. It costs zero bytes and zero requests, so it is
 *      on screen at first paint and the flash never happens.
 *   2. The poster still, 21 KB of AVIF, which arrives long before 1.9 MB of
 *      video and matches frame 0 exactly, so there is no jump when playback
 *      starts.
 *
 * This is also the fallback whenever the video never paints at all — autoplay
 * refused (iOS Low Power Mode), media blocked, reduced motion. A still of the
 * same footage is a better fallback there than an unrelated purple gradient,
 * which no longer matches anything else on the page.
 *
 * The trade-off, stated plainly: an opaque backdrop above the gradients means
 * the gradients are now reached only if the poster *also* fails to load, or
 * images are off. CSS cannot distinguish "still loading" from "failed", so
 * killing the flash and keeping gradients as the common failure state are
 * mutually exclusive without client-side JS. The flash is certain and happens
 * to everyone; total video failure is near-impossible given H.264 is
 * universal. Hence this trade.
 *
 * ## The asset
 *
 * The particle-DNA loop from the Wix page /gras, re-encoded for this site.
 * Purely decorative, so it is hidden from the accessibility tree, taken out
 * of the tab order, and made click-through in CSS.
 *
 * Encoding decisions, measured rather than assumed (ffmpeg 9.0.1, from the
 * 720p Wix rendition; VMAF is fidelity to that file, which is itself a lossy
 * re-encode, not absolute quality):
 *
 * - **Two sources, AV1 first.** The browser takes the first `<source>` whose
 *   `type` it can decode: AV1-capable clients get 1.90 MB, everyone else
 *   2.36 MB. A VP9/WebM tier was encoded and dropped — on this footage VP9
 *   scored VMAF 80.9 at 2.27 MB where H.264 scored 86.9 at 2.46 MB, so it
 *   would have cost bytes and handed whoever received it a worse picture.
 *
 * - **8-bit, not 10-bit.** 10-bit AV1 came out the same size with marginally
 *   better numbers, but 8-bit has a hardware-decode path on far more mobile
 *   silicon. This decodes for as long as the visitor stays, so battery wins.
 *
 * - **No audio track.** The Wix source carried a stale AAC stream it played
 *   muted — 20 s of audio shipped to every visitor for nothing.
 *
 *     AV1   libsvtav1 -preset 4 -crf 34 -pix_fmt yuv420p            VMAF 88.48
 *     H.264 libx264 -preset veryslow -crf 27 -x264-params aq-mode=3 VMAF 87.34
 *
 *   `aq-mode=3` biases bits toward the shadows; the footage is mean luma
 *   35/255 with flat dark gradients and bands without it.
 */

// Exact codec strings, read off the encoded files rather than guessed. Getting
// one wrong is quietly expensive: a browser that cannot parse the `type` skips
// that source, so a malformed AV1 string would send every visitor to the
// larger H.264 file and make the AV1 encode dead weight.
//   av01.0.05M.08 = AV1 Main profile, level 3.1 (seq_level_idx 5), Main tier, 8-bit
//   avc1.640028   = H.264 High profile (0x64), no constraints, level 4.0 (0x28)
const AV1_TYPE = 'video/mp4; codecs="av01.0.05M.08"';
const H264_TYPE = 'video/mp4; codecs="avc1.640028"';

export function BackgroundVideo() {
  return (
    <div className="background-video" aria-hidden="true">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/video/dna-helix-poster.avif"
        tabIndex={-1}
      >
        <source src="/video/dna-helix-720p.av1.mp4" type={AV1_TYPE} />
        <source src="/video/dna-helix-720p.h264.mp4" type={H264_TYPE} />
      </video>
    </div>
  );
}
