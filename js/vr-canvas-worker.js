// Copyright 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

importScripts('./third-party/gl-matrix-min.js');

importScripts('./third-party/wglu/wglu-program.js');
importScripts('./third-party/wglu/wglu-stats.js');
importScripts('./third-party/wglu/wglu-texture.js');

importScripts('./vr-cube-sea.js');

var vrDisplay = null;
var frameData = null;
var projectionMat = mat4.create();
var viewMat = mat4.create();

var webglCanvas = null;
var gl = null;
var cubeSea = null;
var stats = null;

var canvasWidth = 1024;
var canvasHeight = 1024;

onmessage = function(msg) {
  switch(msg.data.type) {
    case 'initWebGL':
      initWebGL(msg.data.preserveDrawingBuffer);
      break;
    case 'onAnimationFrame':
      onAnimationFrame(msg.data.timestamp);
      break;
    case 'onResize':
      //canvasWidth = msg.data.width;
      //canvasHeight = msg.data.height;
      onResize();
      break;
    default:
      throw 'Unexpected message type: ' + msg.data.type;
  }
};

function initWebGL (preserveDrawingBuffer) {
  webglCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);

  // Setting preserveDrawingBuffer to true prevents the canvas from being
  // implicitly cleared when calling submitFrame or compositing the canvas
  // on the document. For the simplest form of mirroring we want to create
  // the canvas with that option enabled. Note that this may incur a
  // performance penalty, as it may imply that additional copies of the
  // canvas backbuffer need to be made. As a result, we ONLY want to set
  // that if we know the VRDisplay has an external display, which is why
  // we defer WebGL initialization until after we've gotten results back
  // from navigator.getVRDisplays and know which device we'll be
  // presenting with.
  var glAttribs = {
    alpha: false,
    //antialias: !VRSamplesUtil.isMobile(),
    preserveDrawingBuffer: preserveDrawingBuffer
  };
  gl = webglCanvas.getContext("webgl", glAttribs);
  gl.clearColor(0.1, 0.2, 0.3, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  var textureLoader = new WGLUTextureLoader(gl);
  var texture = textureLoader.loadTexture("../media/textures/cube-sea.png");
  cubeSea = new VRCubeSea(gl, texture);
  stats = new WGLUStats(gl);

  // Wait until we have a WebGL context to resize and start rendering.
  //window.addEventListener("resize", onResize, false);
  //onResize();
  //window.requestAnimationFrame(onAnimationFrame);

  /*if (navigator.getVRDisplays) {
    frameData = new VRFrameData();

    navigator.getVRDisplays().then(function (displays) {
      if (displays.length > 0) {
        vrDisplay = displays[0];
        vrDisplay.depthNear = 0.1;
        vrDisplay.depthFar = 1024.0;

        //VRSamplesUtil.addButton("Reset Pose", "R", null, function () { vrDisplay.resetPose(); });

        //if (vrDisplay.capabilities.canPresent)
        //  vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "media/icons/cardboard64.png", onVRRequestPresent);

        //window.addEventListener('vrdisplaypresentchange', onVRPresentChange, false);
        //window.addEventListener('vrdisplayactivate', onVRRequestPresent, false);
        //window.addEventListener('vrdisplaydeactivate', onVRExitPresent, false);

        // Only use preserveDrawingBuffer if we have an external display to
        // mirror to.
        initWebGL(vrDisplay.capabilities.hasExternalDisplay);
      } else {
        initWebGL(false);
        VRSamplesUtil.addInfo("WebVR supported, but no VRDisplays found.", 3000);
      }
    });
  }*/
}

function onVRRequestPresent () {
  vrDisplay.requestPresent([{ source: webglCanvas }]).then(function () {
  }, function () {
    //VRSamplesUtil.addError("requestPresent failed.", 2000);
  });
}

function onVRExitPresent () {
  if (!vrDisplay.isPresenting)
    return;

  vrDisplay.exitPresent().then(function () {
  }, function () {
    //VRSamplesUtil.addError("exitPresent failed.", 2000);
  });
}

function onVRPresentChange () {
  onResize();

  if (vrDisplay.isPresenting) {
    if (vrDisplay.capabilities.hasExternalDisplay) {
      //VRSamplesUtil.removeButton(vrPresentButton);
      //vrPresentButton = VRSamplesUtil.addButton("Exit VR", "E", "media/icons/cardboard64.png", onVRExitPresent);
    }
  } else {
    if (vrDisplay.capabilities.hasExternalDisplay) {
      //VRSamplesUtil.removeButton(vrPresentButton);
      //vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "media/icons/cardboard64.png", onVRRequestPresent);
    }
  }
}

function onResize () {
  if (vrDisplay && vrDisplay.isPresenting) {
    // If we're presenting we want to use the drawing buffer size
    // recommended by the VRDevice, since that will ensure the best
    // results post-distortion.
    var leftEye = vrDisplay.getEyeParameters("left");
    var rightEye = vrDisplay.getEyeParameters("right");

    // For simplicity we're going to render both eyes at the same size,
    // even if one eye needs less resolution. You can render each eye at
    // the exact size it needs, but you'll need to adjust the viewports to
    // account for that.
    webglCanvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
    webglCanvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
  } else {
    // We only want to change the size of the canvas drawing buffer to
    // match the window dimensions when we're not presenting.
    webglCanvas.width = canvasWidth;
    webglCanvas.height = canvasHeight;
  }
}

function onAnimationFrame (t) {
  if (!gl)
    return;

  stats.begin();

  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /*if (vrDisplay) {
    vrDisplay.requestAnimationFrame(onAnimationFrame);

    vrDisplay.getFrameData(frameData);

    if (vrDisplay.isPresenting) {
      gl.viewport(0, 0, webglCanvas.width * 0.5, webglCanvas.height);
      cubeSea.render(frameData.leftProjectionMatrix, frameData.leftViewMatrix, stats);

      gl.viewport(webglCanvas.width * 0.5, 0, webglCanvas.width * 0.5, webglCanvas.height);
      cubeSea.render(frameData.rightProjectionMatrix, frameData.rightViewMatrix, stats);

      vrDisplay.submitFrame();
    } else {
      gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
      mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
      cubeSea.render(projectionMat, frameData.leftViewMatrix, stats);
      stats.renderOrtho();
    }
  } else {
    //window.requestAnimationFrame(onAnimationFrame);*/

    // No VRDisplay found.
    gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
    mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
    mat4.identity(viewMat);
    mat4.rotateY(viewMat, viewMat, t/3000.0);
    cubeSea.render(projectionMat, viewMat, stats);

    stats.renderOrtho();
  //}

  stats.end();

  // Send the rendered frame to the main thread
  var imageBitmap = webglCanvas.transferToImageBitmap();
  postMessage({
    type: 'onFrameReady',
    imageBitmap: imageBitmap
  }, [imageBitmap])
}