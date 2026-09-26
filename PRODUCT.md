# Product

## Platform

web

## Stack

Static HTML/CSS/JS, no build step, no dependencies. Hosted on GitHub Pages (https://bakulbadwal.github.io/ducks-eye-view/). Must also work opened straight from the file.

## Users

Primary: the author, an MBA (UVA Darden '27) who isn't an engineer and wants real intuition for robot perception, well enough to read a deployed detector's code and config. Secondary: people taking the Hugging Face Community Computer Vision Course who want to see its ideas inside a real robot, and anyone the author shares it with.

## Product purpose

Teach how a robot sees by following one camera frame through a real robot's vision pipeline, and letting the reader operate every stage:
- pixels and pre-processing (the quarter turn, the letterbox, channel order);
- convolution and YOLO's three grids;
- 2,100 candidate boxes, NMS, IoU and mAP;
- INT8 quantisation and its deployment trade-offs (the shared-scale "about 1.3" score, the thermal limit);
- the pinhole camera and intrinsics (turning a box into a head turn);
- depth from one camera, two cameras, and a time-of-flight grid.

Success: after about 90 minutes of play, the reader can open Microduck's `duck-detect/src/lib.rs` and `deploy/robotd.toml` and explain every number in them.

## Positioning

Interactive CV explainers exist for single ideas: convolution (CNN Explainer, Setosa's image-kernels page), camera matrices, feature visualisation. None follows one frame through a deployed robot's pipeline end to end, and none makes the deployment failures tangible: a pre-processing mismatch that makes a detector "quietly worse", NMS on a real output layout, an INT8 export that turns scores into an on/off switch, a mounting choice that shrinks the field of view. Every one of those comes from the robot's own code comments.

## Operating context

Used at a laptop in study sessions, and on a phone when shared. Steps are done in order (0–6, the bug board, the field test), but people also jump between them. Progress persists in localStorage.

## Constraints

- Every number comes from `js/core.js`. It holds exact pipeline math, some of it ported from `duck-detect`, plus seeded teaching models that are labelled as such. `tests/core.test.js` checks the verified values; `ACCEPTANCE.md` lists them.
- Robot facts come only from `js/microduck.js`, each pinned to pollen-robotics/microduck @ `590b986` and a source line.
- The honesty note (what's exact vs a teaching model) must remain, on the page and in the README.
- The head-workshop metaphor is the vocabulary:

  | The workshop | Means |
  |---|---|
  | eye window | camera |
  | darkroom | pre-processing |
  | stencil room | CNN |
  | box desk with 2,100 pigeonholes | detection head |
  | shredder clerk | NMS |
  | inspector | mAP |
  | tiny ruler | INT8 |
  | map room | intrinsics and geometry |
  | tape measure with 64 beams | ToF |
  | radio mast | BLE |
  | neck crank | head turn |
  | engine room downstairs | the walking policy, which never sees the camera |

## Brand commitments

- Name: **Duck's-Eye View**. A sibling of Policy Pond (how the duck learns to walk) and Inference Kitchen: same design system, head-workshop palette.
- The robot drawn is a generic small biped robot duck, not any company's product or branding.
- Must not look like "every AI tool" (dark ground, neon accent, glowing cards) or like a corporate SaaS dashboard.
