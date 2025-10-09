import { Settings } from "./settings"

export class UIManager {
  constructor() {
    this.recordButton = document.getElementById("record-button")
    this.recordOutline = document.getElementById("outline")
    this.actionButton = document.getElementById("action-buttons")
    this.switchButton = document.getElementById("switch-button")
    this.loadingIcon = document.getElementById("loading")
    this.backButtonContainer = document.getElementById("back-button-container")
    this.recordPressedCount = 0

    // --- Tap to take photo, long press to record ---
    this.longPressTimeout = null
    this.isRecording = false
    this.longPressDuration = 400 // ms

    // Remove any existing click listeners (main.js should not add its own)
    this.recordButton.onclick = null
    this.recordButton.onmousedown = null
    this.recordButton.onmouseup = null
    this.recordButton.ontouchstart = null
    this.recordButton.ontouchend = null

    // Mouse events
    this.recordButton.addEventListener('mousedown', (e) => this._handlePressStart(e))
    this.recordButton.addEventListener('mouseup', (e) => this._handlePressEnd(e))
    this.recordButton.addEventListener('mouseleave', (e) => this._handlePressCancel(e))
    // Touch events
    this.recordButton.addEventListener('touchstart', (e) => this._handlePressStart(e))
    this.recordButton.addEventListener('touchend', (e) => this._handlePressEnd(e))
    this.recordButton.addEventListener('touchcancel', (e) => this._handlePressCancel(e))
  }

  _handlePressStart(e) {
    if (this.isRecording) return
    e.preventDefault()
    // Animate outline scale up and reduce opacity for visual feedback during long press
  this.recordOutline.style.transition = 'transform 0.2s cubic-bezier(0.4,0,0.2,1), opacity 0.2s cubic-bezier(0.4,0,0.2,1)'
  this.recordOutline.style.transformOrigin = 'center center'
  this.recordOutline.style.transform = 'translateX(-50%) scale(1.3)'
  this.recordOutline.style.opacity = '0.5'
    this.longPressTimeout = setTimeout(() => {
      this.isRecording = true
      this.updateRecordButtonState(true)
      // Dispatch custom event for start recording
      this.recordButton.dispatchEvent(new CustomEvent('record-start', {bubbles:true}))
    }, this.longPressDuration)
  }

  _handlePressEnd(e) {
    e.preventDefault()
    // Revert outline animation
  this.recordOutline.style.transform = 'translateX(-50%) scale(1)'
  this.recordOutline.style.opacity = '1'
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout)
      this.longPressTimeout = null
      if (!this.isRecording) {
        // Tap: take photo
        this.recordButton.dispatchEvent(new CustomEvent('photo-capture', {bubbles:true}))
      } else {
        // End recording
        this.isRecording = false
        this.updateRecordButtonState(false)
        this.recordButton.dispatchEvent(new CustomEvent('record-stop', {bubbles:true}))
      }
    }
  }

  _handlePressCancel(e) {
    // Revert outline animation
  this.recordOutline.style.transform = 'translateX(-50%) scale(1)'
  this.recordOutline.style.opacity = '1'
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout)
      this.longPressTimeout = null
    }
    if (this.isRecording) {
      this.isRecording = false
      this.updateRecordButtonState(false)
      this.recordButton.dispatchEvent(new CustomEvent('record-stop', {bubbles:true}))
    }
  }

  toggleRecordButton(isVisible) {
    if (isVisible) {
      this.recordOutline.style.display = "block"
      this.recordButton.style.display = "block"
    } else {
      this.recordOutline.style.display = "none"
      this.recordButton.style.display = "none"
    }
  }

  updateRecordButtonState(isRecording) {
    this.recordButton.style.backgroundImage = isRecording
      ? `url('${Settings.ui.recordButton.stopImage}')`
      : `url('${Settings.ui.recordButton.startImage}')`
    this.recordPressedCount++
  }

  showLoading(show) {
    this.loadingIcon.style.display = show ? "block" : "none"
  }

  displayPostRecordButtons(url, fixedBlob) {
    // Device detection
    const isMobileOrTablet = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const shareButton = document.getElementById("share-button")
    const downloadButton = document.getElementById("download-button")
    if (shareButton && downloadButton) {
      if (isMobileOrTablet) {
        shareButton.style.display = "inline-block"
        downloadButton.style.display = "none"
      } else {
        shareButton.style.display = "none"
        downloadButton.style.display = "inline-block"
      }
    }
    shareButton.style.position = "absolute"
    shareButton.style.transform = "translateX(-50%)"
    shareButton.style.left = "50%"
    downloadButton.style.position = "absolute"
    downloadButton.style.transform = "translateX(-50%)"
    downloadButton.style.left = "50%"

    // Move the back button directly into the action-buttons container
    const actionButtons = document.getElementById("action-buttons")
    const backButton = document.getElementById("back-button")
    if (actionButtons && backButton) {
      actionButtons.insertBefore(backButton, actionButtons.firstChild)
      backButton.style.height = "125px"
      backButton.style.width = "125px"
      backButton.style.left = "11.75vw"
      backButton.style.position = "relative"
      actionButtons.style.width = "100%"
      // backButton.style.display = "inline-block"
      // backButton.style.marginRight = "12px"
      // backButton.style.marginBottom = "0"
    }

    this.actionButton.style.display = "block"
    this.switchButton.style.display = "none"

    if (Settings.ui.displayPreview) {
      this.displayPreview(url)
    }

    document.getElementById("download-button").onclick = () => {
      const a = document.createElement("a")
      a.href = url
      a.download = Settings.recording.outputFileName
      a.click()
      a.remove()
    }

    document.getElementById("share-button").onclick = async () => {
      try {
        const file = new File([fixedBlob], Settings.recording.outputFileName, {
          type: Settings.recording.mimeType,
        })

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Recorded Video",
            text: "Check out this recording!",
          })
          console.log("File shared successfully")
        } else {
          console.error("Sharing files is not supported on this device.")
        }
      } catch (error) {
        console.error("Error while sharing:", error)
      }
    }

    document.getElementById("back-button").onclick = async () => {
      this.actionButton.style.display = "none"
      this.backButtonContainer.style.display = "none"
      this.switchButton.style.display = "block"
      this.toggleRecordButton(true)
      if (Settings.ui.displayPreview) {
        this.removePreview()
      }
    }
  }

  updateRenderSize(source, renderTarget) {
    const width = window.innerWidth
    const height = window.innerHeight

    renderTarget.style.width = `${width}px`
    renderTarget.style.height = `${height}px`
    source.setRenderSize(width, height)
  }

  displayPreview(dataURL) {
    // Add white text below the video preview
    let previewText = document.createElement("div")
    previewText.id = "preview-lorem"
    previewText.innerHTML = `Download you photo and share! Tag us on Instagram<br>@altrarunning @experienceanewhigh`
    previewText.style = `
      position: fixed;
      left: 0;
      right: 0;
      bottom: 2vh;
      color: white;
      text-align: center;
      font-size: 2em;
      font-family: sans-serif;
      z-index: 1100;
      pointer-events: none;
      line-height: 1.2;
      text-shadow: 0 2px 8px #000;
    `
    document.body.appendChild(previewText)
    // Create a fullscreen black background div
    const bg = document.createElement("div")
    bg.id = "preview-bg"
    bg.style = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: black;
      z-index: 998;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    `
    document.body.appendChild(bg)

    // Create a container for the canvas to size it responsively
    const container = document.createElement("div")
    container.id = "preview-container"
    container.style = `
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
      box-shadow: 0 0 40px 0 #000;
      border-radius: 20px;
      background: black;
      overflow: hidden;
      max-width: 76.5vw;
      max-height: 76.5vh;
      margin-top: 5vh;
    `
    bg.appendChild(container)

    let preview
    if (typeof dataURL === 'string' && dataURL.startsWith('data:image/')) {
      // Show image in preview
      preview = document.createElement('img')
      preview.src = dataURL
      preview.id = 'preview'
      preview.style = `
        display: block;
        max-width: 98%;
        max-height: calc(100% - 18px);
        margin: 0 auto;
        border-radius: 50px;
        background: black;
        border: 8px solid white;
      `
      container.appendChild(preview)
    } else {
      // Create the video element (visually hidden, but audio plays)
      preview = document.createElement("video")
      preview.src = dataURL
      preview.id = "preview"
      preview.controls = false
      preview.autoplay = true
      preview.loop = true
      preview.playsInline = true
      preview.muted = false // Allow audio to play
      preview.volume = 1.0
      // Visually hide but keep audio
      preview.style = `
        position: absolute;
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
        z-index: -1;
      `
      document.body.appendChild(preview)
      // Create the canvas
      const canvas = document.createElement("canvas")
      canvas.id = "preview-canvas"
      canvas.style = `
        display: block;
        max-width: 98%;
        max-height: calc(100% - 18px);
        margin: 0 auto;
        border-radius: 50px;
        background: black;
        border: 8px solid white;
      `
      container.appendChild(canvas)
      // Draw video frames to canvas
      function drawVideoToCanvas() {
        if (preview.readyState >= 2) {
          // Set canvas size to match video
          if (canvas.width !== preview.videoWidth || canvas.height !== preview.videoHeight) {
            canvas.width = preview.videoWidth
            canvas.height = preview.videoHeight
            // Responsive container sizing
            let maxW = window.innerWidth * 0.765
            let maxH = window.innerHeight * 0.765
            let ratio = preview.videoWidth / preview.videoHeight
            let containerW = maxW
            let containerH = maxW / ratio
            if (containerH > maxH) {
              containerH = maxH
              containerW = maxH * ratio
            }
            container.style.width = containerW + "px"
            container.style.height = containerH + "px"
          }
          const ctx = canvas.getContext("2d")
          ctx.drawImage(preview, 0, 0, canvas.width, canvas.height)
        }
        requestAnimationFrame(drawVideoToCanvas)
      }
      preview.addEventListener("play", () => {
        drawVideoToCanvas()
      })
      // Start drawing if already playing
      if (!preview.paused) {
        drawVideoToCanvas()
      }
      // Start playback (autoplay)
      preview.play()
    }
  }

  removePreview() {
  // Remove the preview text if present
  const previewText = document.getElementById("preview-lorem")
  if (previewText) previewText.remove()
    // Restore back button position
    const backButtonContainer = document.getElementById("back-button-container")
    if (backButtonContainer) {
      backButtonContainer.style.position = "absolute"
      backButtonContainer.style.top = "2%"
      backButtonContainer.style.left = "3%"
      backButtonContainer.style.right = ""
      backButtonContainer.style.bottom = ""
      backButtonContainer.style.transform = "none"
      backButtonContainer.style.zIndex = 1000
      // Do not force display, let logic handle it
    }
    const preview = document.getElementById("preview")
    if (preview) preview.remove()
    const bg = document.getElementById("preview-bg")
    if (bg) bg.remove()
    if (preview || bg) {
      console.log("Preview removed")
    } else {
      console.log("No preview to remove")
    }
  }
}
