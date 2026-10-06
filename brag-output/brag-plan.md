# brag plan: SOPstart splash reel (/welcome)

The page is the video: a looping in-browser reel, then a 20 s Sign in hold (owner's call).

## Answers
- **What is it?** SOPstart turns a site's Word/PDF SOPs into step-by-step procedures pinned to the machines they run on.
- **For whom?** NZ/AU industrial sites (glass, bottling, machine shops): workers walk SOPs on a phone; supervisors sign off; admins convert the old documents.
- **What sets it apart?** The SOP lives *on the machine* in an isometric map of the site, and every SOP has the same four kinds of step (Hazard, PPE, Step, Check).
- **Most impressive claim:** upload the old Word doc and get a structured SOP, with an AI reviewer flagging what is missing, and a person approving.
- **Visual hook:** an old `Labeller SOP (2019).docx` over a blurred site, then the site snaps into focus and every machine outlines itself.
- **Real UI to show:** the walk screen (progress bar, "Step N of M", KindChip, "Done — next step") ending on the real "Sent for sign-off / Your supervisor will check it." panel; the machine's SOP list; the four real step kinds and their real colours (`KindChip.tsx`).
- **Tone:** `app-store` with `polished` restraint: clean cards, smooth glides, one claim per scene.
- **Share caption:** "Your SOPs, out of the Word doc and onto the floor: tap a machine, walk the steps, send for sign-off."

## What changes against the laws
| Law | Before | After |
|---|---|---|
| Short | 43 s before the CTA | 24 s before the 20 s CTA hold |
| Hook | Wide shot, outlines draw slowly | The old Word doc over a blurred site: the problem in 1 s |
| Show the thing | Invented colours and section names | Real kinds, colours and walk copy (KindChip, PRIMARY labels, SentPanel) |
| Readable | Long body lines under every headline | One headline per scene (≤ 8 words, ≥ 2.4 s settled); body only on the CTA |
| Alive | Cards fade in | Simulated taps: machine, "Done — next step", "Approve" |

## Storyboard (24 s + 20 s hold)
| # | s | Camera | On screen |
|---|---|---|---|
| 1 Hook | 3 | Wide, blurred | "Your SOPs live in a Word doc." + the .docx card |
| 2 Reveal | 3.5 | Wide, blur lifts | Outlines draw fast; "SOPstart puts them on the floor." |
| 3 Machines | 4.5 | Glide to Line 1 filler-capper | Tap ripple on the machine, its SOP list slides in; "Tap a machine. Get its SOPs." |
| 4 Structure | 4 | Holds | Two SOPs, the four real kinds light in step; "Every SOP reads the same way." |
| 5 Walk | 4.5 | Glide to Line 2 labeller | Real walk card, jam-point circle draws, tap "Done — next step", flips to "Sent for sign-off"; "Show it, don't describe it." |
| 6 AI | 4.5 | Glide to the Office | Rows stream in as real kinds, AI reviewer flag, tap Approve → Approved; "Upload the old SOP. Get a structured one." |
| 7 CTA | 20 | Wide under a veil | SOPstart · "Safe work, one step at a time." · Sign in |

## Not done
- Sound: a browser page cannot autoplay audio, so the reel stays silent.
- `brag.mp4` / poster: the page is the deliverable; a screen recording can be rendered on request.
