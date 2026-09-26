# Case Study: HF Learning Labs
### A product-thinking write-up (not a README). For how to play any lab, open its live link below.

Five hands-on labs, one per Hugging Face course I'm working through. Each turns a course's hardest ideas into something you operate rather than read: widgets run the real math, and every toy is labelled as one.

**The series:**
- **[Arm Playground](https://github.com/bakulbadwal/arm-playground)**: Robotics Course, Unit 2. Kinematics, configuration space, the Jacobian and feedback control, on a two-joint arm with 23 guided lessons.
- **[Policy Pond](https://github.com/bakulbadwal/policy-pond)**: Deep RL Course. Real REINFORCE and PPO in the browser, and reward hacking taken from a real robot's training playbook.
- **[Duck's-Eye View](https://github.com/bakulbadwal/ducks-eye-view)**: Computer Vision Course. One camera frame through a real robot's vision stack, from the letterbox to YOLO's 2,100 boxes, INT8 and the pinhole camera.
- **[Fork in the Road](https://github.com/bakulbadwal/fork-in-the-road)**: Diffusion Models Course. Why robots use diffusion to choose actions, with the real DDPM/DDIM math.
- **[Finishing School](https://github.com/bakulbadwal/finishing-school)**: a smol course. Post-training: SFT, DPO and GRPO, with exact math and a capstone that picks one for three client briefs.

---

## The problem I was solving

I'm an MBA student, not an engineer, learning physical AI and post-training from the Hugging Face courses. The courses are good, but they split into two modes that don't build intuition:

1. **Static pages.** Formulas and diagrams you read once. PPO's clip, a letterbox, an INT8 zero point: you can recite them without being able to predict what happens when one changes.
2. **Notebooks.** Real code, but it needs a GPU runtime and setup. It also buries the one number that matters under forty cells of boilerplate.

The gap: **nothing sat between the page and the notebook.** Nothing let me grab one idea, turn its knob, and watch the real math respond in a few seconds, with no install. The good interactive explainers that exist (CNN Explainer, Setosa's image kernels, the tabular RL demos) each cover one isolated idea. None connects the ideas to a real deployed system.

## Who it's for

Primary user: me. I build each lab while taking its course, and I study from it. That keeps every lab honest to what the course actually teaches, and to what I found confusing.

Secondary users: people taking the same courses who learn by doing. And anyone who wants to see what these ideas look like inside a real robot, not a textbook example.

## The core product insight

**Tie every idea to one real system, and make it operable.** Abstract ideas stick when they explain something real. Two of the labs are built around **Microduck**, a 25 cm open-source robot duck ([pollen-robotics/microduck](https://github.com/pollen-robotics/microduck)):
- Policy Pond reads its actual PPO config line by line.
- Duck's-Eye View follows a frame through its actual detector code.

The most memorable lessons come straight from the robot's own code comments, not from invented examples:
- a colour-channel mix-up that makes the detector "quietly worse";
- a reward term that paid the robot for lying on its back;
- an INT8 export where every detection reads "about 1.3".

## Key product decisions and the trade-offs I made

| Decision | Why | Trade-off I accepted |
|---|---|---|
| **One lab per course, not one mega-app** | Each course is a ~90-minute sitting. A combined app would be a three-hour monolith with no natural stopping point. | More repos to maintain. Mitigated by a shared design system and cross-links between siblings. |
| **Honesty as a product rule: every number is exact or a labelled toy** | A learning tool that quietly fakes numbers teaches the wrong thing, and a sharp reader stops trusting all of it. Each lab ends with a "what's exact, what's a teaching model" card. | Some visuals are less dramatic than they could be. The toy detector's AP is a plain 0.979, stated beside the real model's 0.976, not a hand-tuned "wow" number. |
| **Real code, ported, with the source line cited** | Duck's-Eye View's letterbox, decode and NMS are line-for-line ports of the robot's Rust, and every robot fact links to a pinned commit. The reader can check me. | Pinned to one commit, so facts can go stale as the robot's code moves. I chose accuracy at a date over vagueness. |
| **Predict, then reveal; "say it out loud" unlocks only after play** | Guessing first is what makes the answer stick. The takeaway stays blurred until you've committed a prediction and touched the controls. | Slower for someone who only wants the answer. That's deliberate: they're not the user. |
| **Static HTML/CSS/JS: no build, no backend, no install** | Opens from a link on a phone or from the file on a plane. Friction is what kills study tools. | No accounts, so no cross-device progress or usage analytics (progress lives in `localStorage`). |
| **A shared visual system (Busytown cutaways) with a new world per lab** | Reads as a series: a kitchen, a pond, a robot's head, a town square, a school. Each world's objects *are* the concepts ("shredder clerk = NMS"), so the art teaches. | Hand-drawn SVG scenes are the most expensive part of each build. Arm Playground predates the system and stays the odd one out. |

## How it was built (the part I own)

I build with coding agents, and I own the product decisions, the teaching design, verification and delivery. The process that made the labs trustworthy:

1. **Math first, as pure functions with tests.** The newer labs keep the exact formulas in one module. Duck's-Eye View runs 48 deterministic checks with `node tests/core.test.js` (no dependencies). Every value was worked by hand in my study notes first.
2. **Parallel builders on a written brief.** For Duck's-Eye View, four agents built the steps in parallel against one design brief, one framework API and one file of cited robot facts, so no one could invent a robot claim.
3. **Fresh-context adversarial review before publishing.** Reviewers with no stake in the build tried to break each lab, and they caught real defects every time:
   - Policy Pond: GAE presets whose "nothing surprising happens" case scored a non-zero advantage.
   - Duck's-Eye View: charts that doubled in height on every redraw on Retina screens; that fix then went back into two earlier labs that had the same bug.
   - Also: swapped image crops, and places where copy overclaimed what the robot's code does.
4. **Verified live, not just locally.** Zero console errors, no horizontal scroll at phone width, and the deployed GitHub Pages site checked after every push.

## How I'd measure success

The honest version: these are local-first with no telemetry, so today I can't see usage. What I'd track if I added it:

**North star: prediction accuracy on a learner's second visit.** Are the predict-then-reveal questions answered right the second time without opening the answer? That's the job: intuition that sticks.

**Supporting metrics:**
- **Activation:** % of visitors who operate a widget and answer ≥ 1 prediction (not just scroll the art).
- **Completion:** % who unlock every "say it out loud" line in a lab; field-test scores (≥ 6 / 8 earns the check).
- **Transfer:** can the learner read the real artifact afterwards (Microduck's PPO config, its detector code)? That's the stated success criterion in each lab's product brief. It's measurable by interview, not analytics.

**What I don't know yet:** whether other learners use these, or only me. The next signal I'd want is qualitative: does a classmate taking the same course come back to a lab a second time?

## What's next

- **More courses as they release:** Robotics Units 5–7 (reinforcement learning, imitation learning, foundation models) are still "coming soon" upstream.
- **A series landing page** linking the labs in study order, with one shared progress view.
- **Close the loop with the real robot:** the Duck's-Eye View bug board already mirrors Microduck's actual deployment bugs. The natural next lab is calibrating the robot's camera intrinsics, a real open TODO in its repo.
