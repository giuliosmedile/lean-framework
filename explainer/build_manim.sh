#!/bin/bash
# renders explainer-manim.mp4 (needs .venv with manim); audio from narration/all.wav
cd "$(dirname "$0")"; . .venv/bin/activate
manim -qm scene_manim.py Explainer --fps 30 -o silent.mp4 || exit 1
FF=$(python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
$FF -y -i media/videos/scene_manim/720p30/silent.mp4 -i narration/all.wav -c:v copy -c:a aac -b:a 160k -shortest explainer-manim.mp4
