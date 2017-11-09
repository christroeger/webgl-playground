function Renderer(renderConfig) {
	var fragmentShaderSource = "\
precision mediump float;\
varying vec4 vColor;\
void main(void) {\
    gl_FragColor = vColor;\
}\
";
	var vertexShaderSource = "\
attribute vec3 aVertexPosition;\
attribute vec4 aVertexColor;\
uniform mat4 uMVMatrix;\
uniform mat4 uPMatrix;\
varying vec4 vColor;\
void main(void) {\
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);\
    vColor = aVertexColor;\
}\
";
	var gl;
	var shaderProgram;
	var mvMatrix = mat4.create();
	var mvMatrixStack = [];
	var pMatrix = mat4.create();
	var vBuf= {};
	var canvas = document.createElement("canvas");
	canvas.id = renderConfig.name ;
	canvas.width = renderConfig.width;
	canvas.height = renderConfig.height
	document.getElementById(renderConfig.canvasBox).appendChild(canvas);
	initGL(canvas);
	initShaders();
	initVertexBuffer();
	gl.clearColor(renderConfig.backgroundColor[0], renderConfig.backgroundColor[1], renderConfig.backgroundColor[2], renderConfig.backgroundColor[3]);
	gl.enable(gl.DEPTH_TEST);
	var isRunning = true;
	var camera = {
		x: renderConfig.camera.x,
		y: renderConfig.camera.y,
		z: renderConfig.camera.z,
		pitch: renderConfig.camera.pitch,
		yaw: renderConfig.camera.yaw,
		roll: renderConfig.camera.roll,
		fov: renderConfig.camera.fov,
		nearPlane: renderConfig.camera.nearPlane,
		farPlane: renderConfig.camera.farPlane,
		viewport : {
			x: renderConfig.camera.viewport.x,
			y: renderConfig.camera.viewport.y,
			width: renderConfig.camera.viewport.width,
			height: renderConfig.camera.viewport.height
		}
	};
	var mouse = {x:0, y:0, z:0, down: false, active: false};
	var lastMouse = null;
	var keysDown = {};
	var lastTime = 0;
	var elapsed = 0;
	var fps = 0;
	var requestAnimFrame = (function(){
		return  window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			function(callback){
				window.setTimeout(callback, 1000 / 60);
			};
	})();


	document.addEventListener('pointerlockchange', pointerLockChangeCallback, false);
	document.addEventListener('mozpointerlockchange', pointerLockChangeCallback, false);
	document.addEventListener('webkitpointerlockchange', pointerLockChangeCallback, false);
	function mouseMoveCallback(e) {
		var movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
		var movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
		mouse.x += movementX;
		mouse.y += movementY;
	}
	function pointerLockChangeCallback() {
		if (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas) {
			document.addEventListener("mousemove", mouseMoveCallback, false);
		} else {
			document.removeEventListener("mousemove", mouseMoveCallback, false);
			document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock || document.webkitExitPointerLock;
			document.exitPointerLock();
		}
	}
	canvas.onmousedown = function(event) {
		mouse.down = true;
		event.preventDefault();
		event.returnValue = false;
	};
	canvas.onmousewheel = function(event) {
		var delta = 0;
		if (!event) {
			event = window.event;
		}
		if (event.wheelDelta) { 
			delta = event.wheelDelta / 120;
		} else if (event.detail) { 
			delta = -event.detail / 3;
		}
		if(delta != 0) {
			mouse.z += delta;
		}
		event.preventDefault();
		event.returnValue = false;
	};
	canvas.onmouseup = function(event) {
		mouse.down = false;
		event.preventDefault();
		event.returnValue = false;
	};
	document.onkeydown = function(event) {
		var key = String.fromCharCode(event.keyCode);
		keysDown[key] = true;
		if(key == "M") {
			mouse.active = !mouse.active;
			if(mouse.active) {
				canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
				canvas.requestPointerLock();
			} else {
				document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock || document.webkitExitPointerLock;
				document.exitPointerLock();
			}
		}
		event.preventDefault();
		event.returnValue = false;
	};
	document.onkeyup = function(event) {
		var key = String.fromCharCode(event.keyCode);
		keysDown[key] = false;
		event.preventDefault();
		event.returnValue = false;
	};
	

	run();
	
	function initGL(canvas) {
		try {
			gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
			gl.viewportWidth = canvas.width;
			gl.viewportHeight = canvas.height;
		} catch (e) {
		}
		if (!gl) {
			alert("WebGL not available!");
		}
	}

	function initShaders() {
		var vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertexShader, vertexShaderSource);
		gl.compileShader(vertexShader);
		if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
			alert(gl.getShaderInfoLog(vertexShader));
		}
		var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader, fragmentShaderSource);
		gl.compileShader(fragmentShader);
		if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
			alert(gl.getShaderInfoLog(fragmentShader));
		}
		shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			alert("Could not initialize shaders");
		}
		gl.useProgram(shaderProgram);
		shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
		gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
		shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
		gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);
		shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
		shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
	}

	function mvPushMatrix() {
		var copy = mat4.create();
		mat4.copy(copy, mvMatrix);
		mvMatrixStack.push(copy);
	}

	function mvPopMatrix() {
		if (mvMatrixStack.length == 0) {
		    throw "Invalid popMatrix!";
		}
		mvMatrix = mvMatrixStack.pop();
	}

	function setMatrixUniforms() {
		gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
		gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
	}

	function degToRad(deg) {
		return deg * Math.PI / 180;
	}

	function run() {
		if(isRunning) {
			requestAnimFrame(run);
			drawScene();
		}
	}

	function drawScene() {
		try {
			document.getElementById(renderConfig.statusBox).innerHTML = "<pre>"
				+ "\nCamera: " + JSON.stringify(camera, null, " ") 
				+ "\nMouse: " + JSON.stringify(mouse, null, " ") 
				+ "\nKeys: " + JSON.stringify(keysDown, null, " ") 
				+ "</pre>";
			var timeNow = new Date().getTime();
			if (lastTime != 0) {
			
			
				// Calculate fps
				var deltaTime = timeNow - lastTime;
				elapsed += deltaTime;
				fps++;
				if(elapsed > 1000) {
					document.getElementById(renderConfig.fpsBox).innerHTML = "<pre>FPS: " + fps + "</pre>";
					elapsed = 0;
					fps = 0;
				}
				
				
				// Reset camera if "R" was hit
				if (keysDown["R"]) {
					camera = {
						x: renderConfig.camera.x,
						y: renderConfig.camera.y,
						z: renderConfig.camera.z,
						pitch: renderConfig.camera.pitch,
						yaw: renderConfig.camera.yaw,
						roll: renderConfig.camera.roll,
						fov: renderConfig.camera.fov,
						nearPlane: renderConfig.camera.nearPlane,
						farPlane: renderConfig.camera.farPlane,
						viewport : {
							x: renderConfig.camera.viewport.x,
							y: renderConfig.camera.viewport.y,
							width: renderConfig.camera.viewport.width,
							height: renderConfig.camera.viewport.height
						}
					};
					mouse.z = 0;
				}
				
				
				// Mouselook
				if(mouse.active) {
					if(lastMouse != null) {
						camera.yaw -= renderConfig.movement.mouseSensitivity * (mouse.x - lastMouse.x);
						camera.pitch -= renderConfig.movement.mouseSensitivity * (mouse.y - lastMouse.y);
						camera.fov += renderConfig.movement.mouseWheelSensitivity * (mouse.z - lastMouse.z);
						camera.pitch = Math.max(-89, camera.pitch);
						camera.pitch = Math.min(89, camera.pitch);
						camera.fov = Math.min(179, Math.max(1, camera.fov));
					}
					lastMouse = {x: mouse.x, y: mouse.y, z: mouse.z, down: mouse.down, active: mouse.active};
				} else {
					lastMouse = null;
				}
				
				
				// Calulate look-at point
				var lookAtPoint = vec3.create();
				var cameraPos = vec3.fromValues(camera.x, camera.y, camera.z);
				var direction = vec3.fromValues(Math.cos(degToRad(camera.pitch)) * Math.sin(degToRad(camera.yaw)), Math.sin(degToRad(camera.pitch)), Math.cos(degToRad(camera.pitch)) * Math.cos(degToRad(camera.yaw)));
				var right = vec3.fromValues(Math.sin(degToRad(camera.yaw - 90)), 0, Math.cos(degToRad(camera.yaw - 90)));
				var up = vec3.create();
				vec3.cross(up, right, direction);
				vec3.scale(direction, direction, deltaTime * renderConfig.movement.movementScale);
				vec3.scale(right, right, deltaTime * renderConfig.movement.movementScale);
				vec3.scale(up, up, deltaTime * renderConfig.movement.movementScale);
				if(mouse.active) {
					if (keysDown[renderConfig.movement.forward]) {
						vec3.add(cameraPos, cameraPos, direction);
					}
					if (keysDown[renderConfig.movement.backward]) {
						vec3.sub(cameraPos, cameraPos, direction);
					}
					if (keysDown[renderConfig.movement.left]) {
						vec3.sub(cameraPos, cameraPos, right);
					}
					if (keysDown[renderConfig.movement.right]) {
						vec3.add(cameraPos, cameraPos, right);
					}
					if (keysDown[renderConfig.movement.up]) {
						vec3.add(cameraPos, cameraPos, up);
					}
					if (keysDown[renderConfig.movement.down]) {
						vec3.sub(cameraPos, cameraPos, up);
					}
				}
				vec3.add(lookAtPoint, cameraPos, direction);
				camera.x = cameraPos[0];
				camera.y = cameraPos[1];
				camera.z = cameraPos[2];
				
				
				// Set projection and modelview matrix
				mat4.perspective(pMatrix, 1/degToRad(camera.fov), gl.viewportWidth / gl.viewportHeight, camera.nearPlane, camera.farPlane);
				mat4.lookAt(mvMatrix, cameraPos, lookAtPoint, up)
				
				
				// Render everything
				gl.viewport(camera.viewport.x, camera.viewport.y, camera.viewport.width, camera.viewport.height);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				for(var key in vBuf) {
					mvPushMatrix();
						vBuf[key].prepare();
						gl.bindBuffer(gl.ARRAY_BUFFER, vBuf[key].buffer);
						gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vBuf[key].buffer.itemSize, gl.FLOAT, false, 0, 0);
						gl.bindBuffer(gl.ARRAY_BUFFER, vBuf[key].colorBuffer);
						gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, vBuf[key].colorBuffer.itemSize, gl.FLOAT, false, 0, 0);
						setMatrixUniforms();
						vBuf[key].render();
					mvPopMatrix();
				}
			}
			lastTime = timeNow;
		} catch(ex) {
			document.getElementById(renderConfig.errorBox).innerHTML = "<pre>" + ex.stack + "</pre>";
			isRunning = false;
		}
	}

	function initVertexBuffer() {
		vBuf = {
			// TODO
			xAxis: {
				buffer: gl.createBuffer(),
				colorBuffer: gl.createBuffer(),
				vertices: [
					1000, 0, 0,
					-1000, 0, 0
				],
				color: [1, 0, 0, 1],
				config: {
				},
				init: function() {
				},
				prepare: function() {
				},
				render: function() {
					gl.drawArrays(gl.LINES, 0, this.buffer.numItems);
				}
			},
			yAxis: {
				buffer: gl.createBuffer(),
				colorBuffer: gl.createBuffer(),
				vertices: [
					0, 1000, 0,
					0, -1000, 0
				],
				color: [0, 1, 0, 1],
				config: {
				},
				init: function() {
				},
				prepare: function() {
				},
				render: function() {
					gl.drawArrays(gl.LINES, 0, this.buffer.numItems);
				}
			},
			zAxis: {
				buffer: gl.createBuffer(),
				colorBuffer: gl.createBuffer(),
				vertices: [
					0, 0, 1000,
					0, 0, -1000
				],
				color: [0, 0, 1, 1],
				config: {
				},
				init: function() {
				},
				prepare: function() {
				},
				render: function() {
					gl.drawArrays(gl.LINES, 0, this.buffer.numItems);
				}
			},
			cube: {
				buffer: gl.createBuffer(),
				colorBuffer: gl.createBuffer(),
				vertices: [
				  // Front face
				  -1.0, -1.0,  1.0,
				   1.0, -1.0,  1.0,
				   1.0,  1.0,  1.0,
				  -1.0,  1.0,  1.0,

				  // Back face
				  -1.0, -1.0, -1.0,
				  -1.0,  1.0, -1.0,
				   1.0,  1.0, -1.0,
				   1.0, -1.0, -1.0,

				  // Top face
				  -1.0,  1.0, -1.0,
				  -1.0,  1.0,  1.0,
				   1.0,  1.0,  1.0,
				   1.0,  1.0, -1.0,

				  // Bottom face
				  -1.0, -1.0, -1.0,
				   1.0, -1.0, -1.0,
				   1.0, -1.0,  1.0,
				  -1.0, -1.0,  1.0,

				  // Right face
				   1.0, -1.0, -1.0,
				   1.0,  1.0, -1.0,
				   1.0,  1.0,  1.0,
				   1.0, -1.0,  1.0,

				  // Left face
				  -1.0, -1.0, -1.0,
				  -1.0, -1.0,  1.0,
				  -1.0,  1.0,  1.0,
				  -1.0,  1.0, -1.0,
				],
				color: [1, 0.5, 0, 0.3],
				config: {
					rotationCount : 0,
				},
				init: function() {
				},
				prepare: function() {
					this.config.rotationCount  += 2;
					this.config.rotationCount %= 360;
					mat4.translate(mvMatrix, mvMatrix, [2, 2, 0]);
					mat4.rotate(mvMatrix, mvMatrix, degToRad(this.config.rotationCount), [0, 1, 0]);
				},
				render: function() {
					gl.drawArrays(gl.LINE_STRIP , 0, this.buffer.numItems);
				}
			}
		};

		for(var key in vBuf) {
			var colors = [];
			for(var i=0; i<vBuf[key].vertices.length; ++i) {
				colors = colors.concat(vBuf[key].color);
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, vBuf[key].buffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vBuf[key].vertices), gl.STATIC_DRAW);
			vBuf[key].buffer.itemSize = 3;
			vBuf[key].buffer.numItems = vBuf[key].vertices.length / 3;

			gl.bindBuffer(gl.ARRAY_BUFFER, vBuf[key].colorBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
			vBuf[key].colorBuffer.itemSize = 4;
			vBuf[key].colorBuffer.numItems = vBuf[key].vertices.length / 3;
		}
	}
}
