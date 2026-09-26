# Design: Duck's-Eye View

Duck's-Eye View uses the design system recorded in [Inference Kitchen's DESIGN.md](https://github.com/bakulbadwal/inference-kitchen/blob/master/DESIGN.md), as Policy Pond does:
- a Busytown cross-section spread, with flat gouache fields on warm paper and one warm-brown outline;
- every object wears a hand-lettered label;
- buttons are painted signs, readouts are price tags on a nail, predictions are sticky notes, and takeaways are chalked on a wood-framed board;
- the type is Grandstander for signboards, Patrick Hand for labels and Andika for body text.

This file records only what the head workshop changes.

## The world

A cutaway of a small robot duck's head, staffed by ducklings in yellow hard hats. Each step is one room: the eye window, the darkroom, the stencil room, the box desk, the tiny-ruler workshop, the map room, the tape-measure room. The legs' engine room sits downstairs in step 0, the one room that never looks at a photo; that's Policy Pond's world.

## Palette additions

| Token | Hex | Use |
|---|---|---|
| lens | `#1F6F74` | masthead, the camera, accents |
| lens-d | `#0F4447` | masthead shadow |
| glass | `#9FD3D6` | lens glass, the camera's eye highlight |
| darkroom | `#3B2A33` | the darkroom walls (step 1) |
| safelight | `#C8452F` | the darkroom light; warnings |
| grey 114 | `#727272` | the letterbox card, exactly the pad colour the model was trained with |
| shell | `#E9EEF0` / `#C9D2D7` | the robot duck's head and body |
| footer | `#18585C` | footer band |

## New objects

- **The synthetic camera.** A portrait 720×1280 room painted with canvas primitives through the same pinhole model the math uses, so a duck's drawn size and its ground-truth box always agree.
- **The pipeline row** (`.pipe` / `.st`). Stations light up as one frame passes through them.
- **The frame panel** (`.frame`). An image canvas with an overlay canvas for boxes, grids and heat.
- **The chalk math box.** Inherited, and used wherever the page claims a number, so the arithmetic is always visible with the live values substituted.

## Scenes

One hand-built SVG scene per step plus the bug board, 960 × 400, in `js/art/`. Each labels its objects with their CV meaning ("shredder clerk = NMS"). The robot is a generic small biped duck, not any company's product.
