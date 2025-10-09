/**
 * Camera Kit Web Demo with Recording Feature
 * Created by gowaaa (https://www.gowaaa.com)
 * A creative technology studio specializing in AR experiences
 *
 * @copyright 2025 GOWAAA
 */

import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit"
import { bootstrapCameraKitWithRemoteAPI } from "./remoteAPI"
import "./styles/index.v3.css"
import { CameraManager } from "./camera"
import { MediaRecorderManager } from "./recorder"
import { UIManager } from "./ui"
import { VideoProcessor } from "./videoProcessor"
import { Settings } from "./settings"
import { launchParams } from "./launchParams"


;(async function () {
  let audioContexts = []
  let monitorNodes = []
  let monitoredStreams = []
  let userMediaStream = null
  let mediaRecorder = null
  let currentRenderTarget
  let cameraKit = null

  setupAudioContextMonitor()
  setupAudioNodeMonitor()

  if (!Settings.config.apiToken || !Settings.config.lensID || !Settings.config.groupID) {
    console.error("Missing required environment variables. Please check your environment settings.")
    return
  }

  // Initialize managers
  const uiManager = new UIManager()
  const cameraManager = new CameraManager()
  const videoProcessor = new VideoProcessor()

  // Initialize Camera Kit
  if (Settings.config.useRemoteAPI) {
    cameraKit = await bootstrapCameraKitWithRemoteAPI()
  } else {
    cameraKit = await bootstrapCameraKit({
      apiToken: Settings.config.apiToken,
      logger: "console", //to show lens print log on the broswer console
    })
  }
  // Get canvas element for live render target
  const liveRenderTarget = document.getElementById("canvas")
  const captureRenderTarget = document.getElementById("capture-canvas")

  // Create camera kit session
  const session = await cameraKit.createSession({ liveRenderTarget })

  //Set captureRenderTarget canvas to render out capture render target from camera kit
  //It is not rendering out anything yet until session.play('capture') is called
  //To record capture render target, set recordCaptureRenderTarget to be true in settings.js
  captureRenderTarget.replaceWith(session.output.capture)

  currentRenderTarget = liveRenderTarget

  // Initialize camera and set up source
  const mediaStream = await cameraManager.initializeCamera()

  const source = createMediaStreamSource(mediaStream, {
    cameraType: "user",
    disableSourceAudio: false,
  })
  await session.setSource(source)
  source.setTransform(Transform2D.MirrorX)
  await source.setRenderSize(window.innerWidth, window.innerHeight)
  await session.setFPSLimit(Settings.camera.fps)
  await session.play() //plays live target by default

  // Load and apply lens
  const lens = await cameraKit.lensRepository.loadLens(Settings.config.lensID, Settings.config.groupID)
  //launchParams allow you to send data to lens at launch, giving you control to trigger different lens effect
  // such as different text, colours, objects visibility etc.
  // See launchParams.js for code sample to use in Lens Studio
  // You may remove launchParams if you have no need for it
  await session.applyLens(lens, launchParams)


  //----------------------------------
  // BABA EDIT PHOTO/VIDEO PREVIEW
  //----------------------------------
  // --- New event listeners for tap/long-press ---
  // Photo capture (tap)
  uiManager.recordButton.addEventListener("photo-capture", async () => {
    // Take a photo from the live video (canvas)
    // Use the current liveRenderTarget canvas
    const canvas = document.createElement('canvas')
    canvas.width = liveRenderTarget.width
    canvas.height = liveRenderTarget.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(liveRenderTarget, 0, 0, canvas.width, canvas.height)
    const dataURL = canvas.toDataURL('image/png')
    // Convert dataURL to Blob for download/share
    function dataURLtoBlob(dataurl) {
      const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n)
      for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i)
      return new Blob([u8arr], { type: mime })
    }
    const photoBlob = dataURLtoBlob(dataURL)
    // Show the photo in the same preview as video, with share/download/back buttons
    uiManager.displayPostRecordButtons(dataURL, photoBlob)
    // Hide record button
    uiManager.toggleRecordButton(false)
  })

  // Start recording (long press)
  uiManager.recordButton.addEventListener("record-start", async () => {
    if (Settings.recording.recordCaptureRenderTarget) {
      liveRenderTarget.style.display = "none"
      await session.play("capture")
      currentRenderTarget = captureRenderTarget
    }
    mediaRecorder = await setupAudioStreams()
    const success = await mediaRecorder.startRecording(session)
    if (success) {
      uiManager.updateRecordButtonState(true)
    }
  })

  // Stop recording (release long press)
  uiManager.recordButton.addEventListener("record-stop", async () => {
    uiManager.updateRecordButtonState(false)
    uiManager.toggleRecordButton(false)
    if (mediaRecorder) mediaRecorder.stopRecording()
    if (Settings.recording.recordCaptureRenderTarget) {
      liveRenderTarget.style.display = "block"
      await session.play("live")
      currentRenderTarget = liveRenderTarget
    }
  })

  uiManager.switchButton.addEventListener("click", async () => {
    try {
      const source = await cameraManager.updateCamera(session)
      uiManager.updateRenderSize(source, liveRenderTarget)
      uiManager.updateRenderSize(source, captureRenderTarget)
    } catch (error) {
      console.error("Error switching camera:", error)
    }
  })
  //----------------------------------
  // END BABA EDIT PHOTO/VIDEO PREVIEW
  //----------------------------------

  // Add back button handler
  document.getElementById("back-button").addEventListener("click", async () => {
    try {
      mediaRecorder.resetRecordingVariables()
      uiManager.updateRenderSize(source, liveRenderTarget)
      uiManager.updateRenderSize(source, captureRenderTarget)
    } catch (error) {
      console.error("Error resetting camera:", error)
    }
  })

  // Add window resize listener
  window.addEventListener("resize", () => uiManager.updateRenderSize(source, liveRenderTarget), uiManager.updateRenderSize(source, captureRenderTarget))

  // Update initial render size
  uiManager.updateRenderSize(source, liveRenderTarget)
  uiManager.updateRenderSize(source, captureRenderTarget)

  //functions for audio monitoring recording
  function setupAudioContextMonitor() {
    const originalAudioContext = window.AudioContext || window.webkitAudioContext
    let capturedAudioContext = null

    window.AudioContext = window.webkitAudioContext = function () {
      capturedAudioContext = new originalAudioContext()
      console.log("Audio context created:", capturedAudioContext)

      audioContexts.push(capturedAudioContext)

      return capturedAudioContext
    }
  }

  function setupAudioNodeMonitor() {
    // Store the original connect method
    const originalConnect = AudioNode.prototype.connect

    // Override the AudioNode.prototype.connect method
    AudioNode.prototype.connect = function (destinationNode) {
      console.log("Audio Node Connecting: " + this + " to " + destinationNode)

      // if the current node is a gainNode, create another stream node and connect it
      if (destinationNode instanceof AudioDestinationNode) {
        console.log("final node found")

        // create monitor node
        let streamNode = this.context.createMediaStreamDestination()
        monitorNodes.push(streamNode)

        // connect current node to the monitor node
        this.connect(streamNode)
      }

      // Call original connect method
      return originalConnect.apply(this, arguments)
    }
  }

  async function setupAudioStreams() {
    // Wait for monitor nodes to be ready
    await waitForMonitorNodes()

    if (Settings.recording.recordMicAudio) {
      userMediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          frameRate: { ideal: Settings.recording.fps },
          facingMode: cameraManager.getConstraints(),
        },
        audio: true,
      })
      monitoredStreams.push(userMediaStream)
    }

    if (Settings.recording.recordLensAudio) {
      for (let i = 0; i < monitorNodes.length; i++) {
        if (monitorNodes[i].stream) {
          monitoredStreams.push(monitorNodes[i].stream)
        }
      }
    }

    return new MediaRecorderManager(videoProcessor, uiManager, monitoredStreams)
  }

  async function waitForMonitorNodes() {
    const maxWait = 1000 // 2 seconds max
    const checkInterval = 100 // Check every 100ms
    let waited = 0

    while (waited < maxWait) {
      const allReady = monitorNodes.every((node) => node && node.stream)
      if (allReady) return

      await new Promise((resolve) => setTimeout(resolve, checkInterval))
      waited += checkInterval
    }

    console.warn("Some monitor nodes may not be ready")
  }
})()
