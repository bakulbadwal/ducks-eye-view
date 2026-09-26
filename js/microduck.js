/* Microduck's real vision stack: every fact the page quotes, pinned to a commit and a source line.
   Repo: https://github.com/pollen-robotics/microduck @ 590b986 (2026-08-27), Apache-2.0.
   Nothing here is a claim about how the real robot performs beyond what its own files say. */
window.DEV_MICRODUCK = {
  repo: "https://github.com/pollen-robotics/microduck",
  commit: "590b986",
  facts: {
    stream:      { v: "1280×720 landscape", src: "mediad/src/session.rs:242-243" },
    turn:        { v: "a quarter turn clockwise to 720×1280 portrait", src: "duck-detect/src/lib.rs:113 (Turn::Right, \"what this robot's camera mount needs\")" },
    sensor:      { v: "IMX219, ~62° field of view", src: "docs/ideas/autonomous_behavior.md:75" },
    rangeMath:   { v: "\"a 25 cm duck is ~25 px at 3 m\"", src: "docs/ideas/autonomous_behavior.md:75-76" },
    intrinsics:  { v: "\"Fix the placeholder IMX219 intrinsics\"", src: "docs/ideas/autonomous_behavior.md:88" },
    model:       { v: "yolo11n, one class, 320×320 input", src: "docs/project/npu-bringup.md:7" },
    candidates:  { v: "2100 candidate boxes out", src: "duck-detect/src/lib.rs:4" },
    pad:         { v: "letterboxed, not stretched, padded with 114 grey", src: "duck-detect/src/lib.rs:11, 26" },
    rgb:         { v: "RGB, not BGR", src: "duck-detect/src/lib.rs:12" },
    quietly:     { v: "\"Get one of those wrong and the detector does not fail — it just gets quietly worse\"", src: "duck-detect/src/lib.rs:16" },
    nearest:     { v: "nearest-neighbour on purpose: bilinear \"costs three times as much to move a box by a pixel\"", src: "duck-detect/src/lib.rs:64-66" },
    oldPreproc:  { v: "converting then shrinking \"cost 345 ms of the 407 ms a look took\"", src: "duck-detect/src/lib.rs:160-164" },
    twenty:      { v: "\"2100 candidates means one duck comes back as twenty overlapping boxes\"", src: "duck-detect/src/lib.rs:233-234" },
    planar:      { v: "the tensor is [1, 5, N]: all cx, then all cy, … not five numbers per box", src: "duck-detect/src/lib.rs:241-243" },
    iouLimit:    { v: "NMS keeps a box only if its IoU with every kept box is below 0.5", src: "duck-detect/src/lib.rs:266-276; bin/duck-bench.rs:189" },
    bearing:     { v: "bearing = (box centre x ÷ frame width)·2 − 1: −1 hard left, 0 ahead, +1 hard right", src: "duck-detect/src/lib.rs:45-52" },
    training:    { v: "150 frames from three sessions, mAP50 0.976 on a held-out session", src: "docs/project/npu-bringup.md:7-8" },
    int8:        { v: "3.9 MB after INT8 quantisation; kept 2 of 2 detections at 95% box overlap vs the float model", src: "docs/project/npu-bringup.md:8-9" },
    npu:         { v: "RK3566 NPU: 0.8 TOPS INT8, one core", src: "docs/project/npu-bringup.md:3" },
    latency:     { v: "p50 25.7 ms / p95 58.4 ms, inference plus decode", src: "docs/project/npu-bringup.md:88" },
    fileSizes:   { v: "duck_detect.onnx 10,477,940 bytes · duck_detect.rknn 3,851,471 bytes", src: "duck-detect/models/ (ls -l)" },
    work:        { v: "\"~60 ms of work every half second\"", src: "deploy/robotd.toml:320-321" },
    thermal:     { v: "\"2 is a thermal limit, not a preference: flat out this reaches 95 °C … the CPU throttles to 408 MHz, which is a robot that walks badly to see well\"", src: "deploy/robotd.toml:330-332" },
    score13:     { v: "\"its scores are not probabilities — every real detection reads about 1.3, and nothing else reads anything at all, because the output tensor shares one quantisation scale with the box coordinates\"", src: "deploy/robotd.toml:334-337" },
    threshold:   { v: "threshold = 0.35", src: "deploy/robotd.toml:338" },
    controlHz:   { v: "the control loop runs at 50 Hz", src: "deploy/robotd.toml:34" },
    dataPlan:    { v: "\"Data is the project, not the model\": footage auto-labelled by a big open-vocabulary model, distilled into the tiny one; synthetic renders from the Open Duck CAD; hard negatives (rubber ducks, white prints)", src: "docs/ideas/autonomous_behavior.md:81-83" },
    fusion:      { v: "\"camera = direction, ToF = distance, BLE beacon = identity + presence\"", src: "docs/ideas/autonomous_behavior.md:84-86" },
    tof:         { v: "VL53L5CX / VL53L8CX: an 8×8 grid of distances over 45° × 45°", src: "tof/src/lib.rs:1-3; kinematics/src/tof.rs:32-34" },
    tofReproject:{ v: "zones → points in the trunk frame through the head's forward kinematics; floor hits and returns under ~10 cm dropped", src: "kinematics/src/tof.rs:1-22" },
    walking:     { v: "the walking policy's observations are proprioceptive (joints, IMU, gravity); it never sees the camera", src: "microduck_rl @ d424a0c README; docs/project/roadmap.md:89" }
  },
  cite: function (key) { var f = this.facts[key]; return f ? '<a class="src" href="' + this.repo + '/blob/' + this.commit + '/' + f.src.split(":")[0].split(" ")[0] + '" target="_blank" rel="noopener">' + f.src + "</a>" : ""; }
};
