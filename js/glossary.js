/* Glossary: key → [term, plain meaning, the head-workshop equivalent]. Keys match data-g attributes.
   Shared terms live here; each step file adds its own with Object.assign(window.DEV_GLOSSARY, {...}). */
window.DEV_GLOSSARY = Object.assign(window.DEV_GLOSSARY || {}, {
  pixel: ["Pixel", "One cell of the image grid. A colour pixel is three numbers, red, green and blue, each 0–255.", "One square of the photo print."],
  frame: ["Frame", "One picture from the camera. Microduck's arrives as 1280×720 and is turned upright to 720×1280.", "One photo coming through the eye window."],
  pipeline: ["Pipeline", "The fixed sequence of steps every frame goes through, from the camera to a decision.", "The conveyor belt through the head, room to room."],
  preprocess: ["Pre-processing", "Everything done to a frame before the model sees it: turning, resizing, padding, colour order, scaling to 0–1. It must match what the model saw in training.", "The darkroom."],
  letterbox: ["Letterbox", "Shrinking a picture to fit a square without stretching it, and filling the leftover space with a flat colour.", "Mounting the print on a grey card."],
  cnn: ["CNN (convolutional neural network)", "A network built from small learned filters slid across the image. Early layers find edges; deeper layers find parts and objects.", "The stencil room."],
  kernel: ["Kernel (filter)", "A small grid of learned weights, often 3×3, slid over the image. At each spot it multiplies and adds, and the result says how strongly that pattern is there.", "A stencil held over the print."],
  yolo: ["YOLO", "“You Only Look Once”: a detector family that predicts boxes for the whole image in one pass. Microduck runs yolo11n, the nano size.", "The box desk's whole crew."],
  candidate: ["Candidate box", "One raw guess from the detector's head: a box and a score. The head makes one per grid cell, 2,100 of them at 320 px, before any clean-up.", "One sticky note from one pigeonhole."],
  score: ["Confidence score", "The detector's number for how sure it is that a box holds the object. In a float model, roughly 0–1. After INT8 on Microduck, not a probability at all.", "How firmly the clerk stamps the note."],
  iou: ["IoU (intersection over union)", "How much two boxes overlap: the shared area divided by the total area they cover. 1 = identical, 0 = no overlap.", "Laying two sticky notes on top of each other."],
  nms: ["NMS (non-maximum suppression)", "The clean-up that turns many overlapping guesses into one: keep the highest-scoring box, drop any box that overlaps a kept one too much, repeat.", "The shredder clerk."],
  map: ["mAP50", "Mean average precision at IoU 0.5: the area under the precision–recall curve, counting a box as right when it overlaps the true box by at least half. With one class, it's just AP50.", "The inspector's report card."],
  int8: ["INT8", "Storing numbers as 8-bit integers (256 levels) instead of 32-bit floats. About 4× smaller in principle and much faster on an NPU, at some cost in precision.", "The tiny ruler with only 256 notches."],
  npu: ["NPU (neural processing unit)", "A small chip built to run neural networks fast and cheaply, usually in INT8. Microduck's RK3566 has one: 0.8 TOPS, one core.", "The little calculator bolted to the desk."],
  intrinsics: ["Intrinsics", "The camera's own numbers: focal length in pixels and the principal point (where the optical axis hits the image). They turn a pixel into a direction.", "The map room's scale and centre mark."],
  bearing: ["Bearing", "In duck-detect: where the box's centre sits across the frame, from −1 (hard left) to +1 (hard right). Linear in pixels, not an angle.", "The arrow the clerk slides to the neck crank."],
  tof: ["ToF (time-of-flight) sensor", "Measures distance by timing light's round trip. Microduck's gives an 8×8 grid of distances over a 45° square.", "The tape measure with 64 beams."],
  proprio: ["Proprioception", "The robot's sense of its own body: joint angles and speeds, the IMU's tilt and spin. Microduck walks on this alone.", "The engine room downstairs, which never looks at a photo."],
  teach: ["Teaching model", "A stand-in built to show the right behaviour and layout, not a measurement of the real system. Labelled wherever it's used.", "A cardboard prop in the workshop."]
});
