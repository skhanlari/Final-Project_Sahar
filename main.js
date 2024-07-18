const vertexShaderSource = `
attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying highp vec2 vTexCoord;
varying highp vec3 vNormal;
void main(void) {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
    vTexCoord = aTexCoord;
    vNormal = mat3(uModelViewMatrix) * aNormal;
}
`;

const fragmentShaderSource = `
precision highp float;
varying highp vec2 vTexCoord;
varying highp vec3 vNormal;
uniform sampler2D uSampler;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
void main(void) {
    vec4 texelColor = texture2D( uSampler, vTexCoord );
    highp vec3 normal = normalize(vNormal);
    highp vec3 lightDir = normalize(uLightDir);

    // Ambient light
    highp vec3 ambientLight = vec3(0.2, 0.2, 0.2);

    // Diffuse light
    float diff = max(dot(normal, lightDir), 0.0);
    highp vec3 diffuse = diff * uLightColor;

    // Specular light
    highp vec3 viewDir = normalize(-uLightDir); // Assuming the view direction is along the light direction
    highp vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 10000000.0);
    highp vec3 specular = spec * uLightColor;

    // Combine the results
    highp vec3 lighting = ambientLight + diffuse + specular;
    gl_FragColor = vec4(lighting * texelColor.rgb, texelColor.a);
}
`;

// Vertex shader source code
var boxVS = `
	attribute vec3 pos;
	uniform mat4 mvp;
	void main()
	{
		gl_Position = mvp * vec4(pos,1);
	}
`;
// Fragment shader source code
var boxFS = `
	precision mediump float;
	void main()
	{
		gl_FragColor = vec4(1,1,1,1);
	}
`;

// Vertex shader source code
const lightViewVS = `
	attribute vec3 pos;
	uniform mat4 mvp;
	void main()
	{
		gl_Position = mvp * vec4(pos,1);
	}
`;
// Fragment shader source code
var lightViewFS = `
	precision mediump float;
	uniform vec3 clr1;
	uniform vec3 clr2;
	void main()
	{
		gl_FragColor = gl_FrontFacing ? vec4(clr1,1) : vec4(clr2,1);
	}
`;

// Compile shaders and create program
function compileShader(source, type, wgl=gl) {
    const shader = wgl.createShader(type);
    wgl.shaderSource(shader, source);
    wgl.compileShader(shader);
    if (!wgl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + wgl.getShaderInfoLog(shader));
        wgl.deleteShader(shader);
        return null;
    }
    return shader;
}

function isPowerOfTwo(value) {
    return (value & (value - 1)) == 0;
}


function MatrixMult( A, B )
{
	var C = [];
	for ( var i=0; i<4; ++i ) {
		for ( var j=0; j<4; ++j ) {
			var v = 0;
			for ( var k=0; k<4; ++k ) {
				v += A[j+4*k] * B[k+4*i];
			}
			C.push(v);
		}
	}
	return C;
}

function createBuffer(data, type, usage) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, data, usage);
    return buffer;
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}


function GetModelViewBox(translationX, translationY, translationZ, rotationX, rotationY )
{
	var transXY = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		translationX, translationY, 0, 1
	];

    var transZ = [
        1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, translationZ, 1
    ];

    var trans = MatrixMult(transZ, transXY);

	var rotX = [
        1, 0, 0, 0,
        0, Math.cos(rotationX), -Math.sin(rotationX), 0,
        0, Math.sin(rotationX), Math.cos(rotationX), 0,
        0, 0, 0, 1
    ];

    var rotY = [
        Math.cos(rotationY), 0, Math.sin(rotationY), 0,
        0, 1, 0, 0,
        -Math.sin(rotationY), 0, Math.cos(rotationY), 0,
        0, 0, 0, 1
    ];
    var rot = MatrixMult(rotY, rotX);
    var modelView = MatrixMult(trans, rot); // first rotate than translate, multiply in reverse order
	return modelView;
}

function GetModelViewSphere(translationX, translationY, translationZ, rotationX, rotationY )
{
	var transXY = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		translationX, translationY, 0, 1
	];

    var transZ = [
        1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, translationZ, 1
    ];

    var trans = MatrixMult(transZ, transXY);

	var rotX = [
        1, 0, 0, 0,
        0, Math.cos(rotationX), -Math.sin(rotationX), 0,
        0, Math.sin(rotationX), Math.cos(rotationX), 0,
        0, 0, 0, 1
    ];

    var rotY = [
        Math.cos(rotationY), 0, Math.sin(rotationY), 0,
        0, 1, 0, 0,
        -Math.sin(rotationY), 0, Math.cos(rotationY), 0,
        0, 0, 0, 1
    ];
    var rot = MatrixMult(rotY, rotX);
    var modelView = MatrixMult(rot, transXY); // first translate along the XY plane then rotate
    modelView = MatrixMult(transZ, modelView); // then translate along the Z axis
	return modelView;
}


class BoxDrawer {
	constructor()
	{
		// Compile the shader program
		this.vertexShader = compileShader(boxVS, gl.VERTEX_SHADER);
        this.fragmentShader = compileShader(boxFS, gl.FRAGMENT_SHADER);
        this.prog = gl.createProgram();
        gl.attachShader(this.prog, this.vertexShader);
        gl.attachShader(this.prog, this.fragmentShader);
        gl.linkProgram(this.prog);
        if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(this.prog));
        }
        gl.useProgram(this.prog);
		
		this.mvp = gl.getUniformLocation( this.prog, 'mvp' );
		
		this.vertPos = gl.getAttribLocation( this.prog, 'pos' );
		
		this.vertbuffer = gl.createBuffer();
		var pos = [
			-1, -1, -1,
			-1, -1,  1,
			-1,  1, -1,
			-1,  1,  1,
			 1, -1, -1,
			 1, -1,  1,
			 1,  1, -1,
			 1,  1,  1 ];
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertbuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);

		this.linebuffer = gl.createBuffer();
		var line = [
			0,1,   1,3,   3,2,   2,0,
			4,5,   5,7,   7,6,   6,4,
			0,4,   1,5,   3,7,   2,6 ];
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.linebuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(line), gl.STATIC_DRAW);
	}
	draw( trans )
	{
		// Draw the line segments
		gl.useProgram( this.prog );
		gl.uniformMatrix4fv( this.mvp, false, trans );
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vertbuffer );
		gl.vertexAttribPointer( this.vertPos, 3, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( this.vertPos );
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.linebuffer );
		gl.drawElements( gl.LINES, 24, gl.UNSIGNED_BYTE, 0 );
	}
}


var lightView;

class LightView
{
	constructor()
	{
		this.canvas = document.getElementById("lightcontrol");
		this.canvas.oncontextmenu = function() {return false;};
		this.gl = this.canvas.getContext("webgl", {antialias: false, depth: true});	// Initialize the GL context
		if (!this.gl) {
			alert("Unable to initialize WebGL. Your browser or machine may not support it.");
			return;
		}
		
		this.gl.clearColor(0.33,0.33,0.33,0);
		this.gl.enable(gl.DEPTH_TEST);
		
		this.rotX = 0;
		this.rotY = 0;
		this.posZ = 5;
		
		this.resCircle = 32;
		this.resArrow = 16;
		this.buffer = this.gl.createBuffer();
		var data = [];
		for ( var i=0; i<=this.resCircle; ++i ) {
			var a = 2 * Math.PI * i / this.resCircle;
			var x = Math.cos(a);
			var y = Math.sin(a);
			data.push( x * .9 );
			data.push( y * .9 );
			data.push( 0 );
			data.push( x );
			data.push( y );
			data.push( 0 );
		}
		for ( var i=0; i<=this.resCircle; ++i ) {
			var a = 2 * Math.PI * i / this.resCircle;
			var x = Math.cos(a);
			var y = Math.sin(a);
			data.push( x );
			data.push( y );
			data.push( -.05 );
			data.push( x );
			data.push( y );
			data.push( 0.05 );
		}
		for ( var i=0; i<=this.resArrow; ++i ) {
			var a = 2 * Math.PI * i / this.resArrow;
			var x = Math.cos(a) * .07;
			var y = Math.sin(a) * .07;
			data.push( x );
			data.push( y );
			data.push( -1 );
			data.push( x );
			data.push( y );
			data.push( 0 );
		}
		data.push( 0 );
		data.push( 0 );
		data.push( -1.2 );
		for ( var i=0; i<=this.resArrow; ++i ) {
			var a = 2 * Math.PI * i / this.resArrow;
			var x = Math.cos(a) * .15;
			var y = Math.sin(a) * .15;
			data.push( x );
			data.push( y );
			data.push( -0.9 );
		}
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
		
		
		this.canvas.style.width  = "";
		this.canvas.style.height = "";
		const pixelRatio = window.devicePixelRatio || 1;
		this.canvas.width  = pixelRatio * this.canvas.clientWidth;
		this.canvas.height = pixelRatio * this.canvas.clientHeight;
		const width  = (this.canvas.width  / pixelRatio);
		const height = (this.canvas.height / pixelRatio);
		this.canvas.style.width  = width  + 'px';
		this.canvas.style.height = height + 'px';
		this.gl.viewport( 0, 0, this.canvas.width, this.canvas.height );
		this.proj = ProjectionMatrix( this.canvas, this.posZ, 30 );
		
		
        this.vertexShader = compileShader(lightViewVS, this.gl.VERTEX_SHADER, this.gl);
        this.fragmentShader = compileShader(lightViewFS, this.gl.FRAGMENT_SHADER, this.gl);
        this.prog = this.gl.createProgram();
        this.gl.attachShader(this.prog, this.vertexShader);
        this.gl.attachShader(this.prog, this.fragmentShader);
        this.gl.linkProgram(this.prog);
        if (!this.gl.getProgramParameter(this.prog, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(this.prog));
        }
        this.gl.useProgram(this.prog);
		this.mvp = this.gl.getUniformLocation( this.prog, 'mvp' );
		this.clr1 = this.gl.getUniformLocation( this.prog, 'clr1' );
		this.clr2 = this.gl.getUniformLocation( this.prog, 'clr2' );
		this.vertPos = this.gl.getAttribLocation( this.prog, 'pos' );
		
		this.draw();
		this.updateLightDir();
		
		this.canvas.onmousedown = function() {
			var cx = event.clientX;
			var cy = event.clientY;
			lightView.canvas.onmousemove = function() {
				lightView.rotY += (cx - event.clientX)/lightView.canvas.width*5;
				lightView.rotX += (cy - event.clientY)/lightView.canvas.height*5;
				cx = event.clientX;
				cy = event.clientY;
				lightView.draw();
				lightView.updateLightDir();
			}
		}
		this.canvas.onmouseup = this.canvas.onmouseleave = function() {
			lightView.canvas.onmousemove = null;
		}
	}
	
	updateLightDir()
	{
		var cy = Math.cos( this.rotY );
		var sy = Math.sin( this.rotY );
		var cx = Math.cos( this.rotX );
		var sx = Math.sin( this.rotX );
        sphereDrawers.forEach((sphereDrawer) => {
            sphereDrawer.setLightDir(-sy, cy * sx, cy * cx);
        });
		drawScene();
	}
	
	draw()
	{
		this.gl.clear( this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT );
		
		this.gl.bindBuffer( this.gl.ARRAY_BUFFER, this.buffer );
		this.gl.vertexAttribPointer( this.vertPos, 3, this.gl.FLOAT, false, 0, 0 );
		this.gl.enableVertexAttribArray( this.buffer );

		this.gl.useProgram( this.prog );
		var mvp = MatrixMult( this.proj, [ 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,this.posZ,1 ] );
		this.gl.uniformMatrix4fv( this.mvp, false, mvp );
		this.gl.uniform3f( this.clr1, 0.6,0.6,0.6 );
		this.gl.uniform3f( this.clr2, 0,0,0 );
		this.gl.drawArrays( this.gl.TRIANGLE_STRIP, 0, this.resCircle*2+2 );

		var mv  = GetModelViewBox( 0, 0, this.posZ, this.rotX, this.rotY );
		var mvp = MatrixMult( this.proj, mv );
		this.gl.uniformMatrix4fv( this.mvp, false, mvp );
		this.gl.uniform3f( this.clr1, 1,1,1 );
		this.gl.drawArrays( this.gl.TRIANGLE_STRIP, 0, this.resCircle*2+2 );
		this.gl.drawArrays( this.gl.TRIANGLE_STRIP, this.resCircle*2+2, this.resCircle*2+2 );
		this.gl.uniform3f( this.clr1, 0,0,0 );
		this.gl.uniform3f( this.clr2, 1,1,1 );
		this.gl.drawArrays( this.gl.TRIANGLE_STRIP, this.resCircle*4+4, this.resArrow*2+2 );
		this.gl.drawArrays( this.gl.TRIANGLE_FAN, this.resCircle*4+4 + this.resArrow*2+2, this.resArrow+2 );
	}
}

// Initialize sphere data
function createSphere(radius, latitudeBands, longitudeBands) {
    const vertexPositionData = [];
    const normalData = [];
    const textureCoordData = [];
    const indexData = [];

    for (let latNumber = 0; latNumber <= latitudeBands; ++latNumber) {
        const theta = latNumber * Math.PI / latitudeBands;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let longNumber = 0; longNumber <= longitudeBands; ++longNumber) {
            const phi = longNumber * 2 * Math.PI / longitudeBands;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;
            const u = 1 - (longNumber / longitudeBands);
            const v = 1 - (latNumber / latitudeBands);

            normalData.push(x);
            normalData.push(y);
            normalData.push(z);
            textureCoordData.push(u);
            textureCoordData.push(v);
            vertexPositionData.push(radius * x);
            vertexPositionData.push(radius * y);
            vertexPositionData.push(radius * z);
        }
    }

    for (let latNumber = 0; latNumber < latitudeBands; ++latNumber) {
        for (let longNumber = 0; longNumber < longitudeBands; ++longNumber) {
            const first = (latNumber * (longitudeBands + 1)) + longNumber;
            const second = first + longitudeBands + 1;
            indexData.push(first);
            indexData.push(second);
            indexData.push(first + 1);

            indexData.push(second);
            indexData.push(second + 1);
            indexData.push(first + 1);
        }
    }

    const vertexPositions = new Float32Array(vertexPositionData);
    const normals = new Float32Array(normalData);
    const textureCoords = new Float32Array(textureCoordData);
    const indices = new Uint16Array(indexData);

    return {
        vertexPositions,
        normals,
        textureCoords,
        indices
    };
}

class SphereDrawer {
    constructor(gl, radius, position, textureUrl, velocity) {
        this.gl = gl;
        this.radius = radius;
        this.position = position;
        this.textureUrl = textureUrl;
        this.velocity = velocity;
        this.mass = this.radius * this.radius * this.radius;

        this.setupBuffers();
        this.loadTexture();

        this.vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
        this.fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
        this.shaderProgram = gl.createProgram();
        gl.attachShader(this.shaderProgram, this.vertexShader);
        gl.attachShader(this.shaderProgram, this.fragmentShader);
        gl.linkProgram(this.shaderProgram);
        if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(this.shaderProgram));
        }
        gl.useProgram(this.shaderProgram);

        this.aPosition = gl.getAttribLocation(this.shaderProgram, 'aPosition');
        this.aNormal = gl.getAttribLocation(this.shaderProgram, 'aNormal');
        this.aTexCoord = gl.getAttribLocation(this.shaderProgram, 'aTexCoord');
        this.uModelViewMatrix = gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix');
        this.uProjectionMatrix = gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix');
        this.uSampler = gl.getUniformLocation(this.shaderProgram, 'uSampler');
    }

    setupBuffers() {
        const sphere = createSphere(this.radius, 30, 30);
        this.positionBuffer = this.createBuffer(sphere.vertexPositions, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
        this.normalBuffer = this.createBuffer(sphere.normals, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
        this.textureCoordBuffer = this.createBuffer(sphere.textureCoords, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
        this.indexBuffer = this.createBuffer(sphere.indices, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
        this.vertexCount = sphere.indices.length;
    }

    createBuffer(data, type, usage) {
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(type, buffer);
        this.gl.bufferData(type, data, usage);
        return buffer;
    }

    loadTexture() {
        this.texture = this.gl.createTexture();
        const image = new Image();
        image.onload = () => {
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
    
            // Check if the texture is NPOT
            if (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) {
                // Use mipmaps and default wrapping for POT textures
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
            } else {
                // Set parameters for NPOT textures
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            }
        };
        image.src = this.textureUrl;
    }

    draw(projectionMatrix) {
        gl.useProgram(this.shaderProgram);
        var modelViewMatrix = GetModelViewSphere(this.position.x, this.position.y, transZ, rotX, rotY);
        var transZaddmat = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, this.position.z, 1 //put the ball in position z
        ];
        modelViewMatrix = MatrixMult(modelViewMatrix, transZaddmat);

        this.gl.uniformMatrix4fv(this.uProjectionMatrix, false, projectionMatrix);
        this.gl.uniformMatrix4fv(this.uModelViewMatrix, false, modelViewMatrix);

        this.gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.aPosition);

        this.gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordBuffer);
        this.gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.aTexCoord);

        this.gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        this.gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.aNormal);

        this.gl.activeTexture(gl.TEXTURE0);
        this.gl.bindTexture(gl.TEXTURE_2D, this.texture);
        this.gl.uniform1i(this.uSampler, 0);

        this.gl.drawElements(gl.TRIANGLES, this.vertexCount, gl.UNSIGNED_SHORT, 0);
    }

    setLightDir(x, y, z) {
        this.gl.useProgram(this.shaderProgram);
        const uLightDir = this.gl.getUniformLocation(this.shaderProgram, 'uLightDir');
        this.uLightColor = gl.getUniformLocation(this.shaderProgram, 'uLightColor');
        this.gl.uniform3f(this.uLightColor, 1, 1, 1);
        this.gl.uniform3f(uLightDir, x, y, z);
    }
}

var boxDrawer;
var sphereDrawers;
var canvas, gl;
var perspectiveMatrix;	
var num_spheres = 5;
var rotX=0, rotY=0, transZ=3, autorot=0;

function InitWebGL()
{
	
	canvas = document.getElementById("canvas");
	gl = canvas.getContext("webgl");
	if (!gl) {
		alert("Unable to initialize WebGL. Your browser or machine may not support it.");
		return;
	}

	gl.clearColor(0,0,0,1);
	gl.enable(gl.DEPTH_TEST);

    sphereDrawers = [];
    for (let i = 0; i < num_spheres; i++) {
        const radius = Math.random() * (0.4 - 0.1) + 0.1;
        const position = {
            x: Math.random() * (2 - 2 * radius) - (1 - radius),
            y: Math.random() * (2 - 2 * radius) - (1 - radius),
            z: Math.random() * (2 - 2 * radius) - (1 - radius)
        };
        const velocity = {
            x: Math.random() * 0.02 - 0.01,
            y: Math.random() * 0.02 - 0.01,
            z: Math.random() * 0.02 - 0.01
        };
        const textureUrl = "texture.png"; 
        const sphereDrawer = new SphereDrawer(gl, radius, position, textureUrl, velocity);
        sphereDrawers.push(sphereDrawer);
    }

    // Initialize the box drawer
    boxDrawer = new BoxDrawer();

	// Set the viewport size
	UpdateCanvasSize();
}


function UpdateCanvasSize()
{
	canvas.style.width  = "100%";
	canvas.style.height = "100%";
	const pixelRatio = window.devicePixelRatio || 1;
	canvas.width  = pixelRatio * canvas.clientWidth;
	canvas.height = pixelRatio * canvas.clientHeight;
	const width  = (canvas.width  / pixelRatio);
	const height = (canvas.height / pixelRatio);
	canvas.style.width  = width  + 'px';
	canvas.style.height = height + 'px';
	gl.viewport( 0, 0, canvas.width, canvas.height );
	UpdateProjectionMatrix();
}

perspectiveMatrix = mat4.create();

function ProjectionMatrix( c, z, fov_angle=60 )
{
	var r = c.width / c.height;
	var n = (z - 1.74);
	const min_n = 0.001;
	if ( n < min_n ) n = min_n;
	var f = (z + 1.74);;
	var fov = 3.145 * fov_angle / 180;
	var s = 1 / Math.tan( fov/2 );
	return [
		s/r, 0, 0, 0,
		0, s, 0, 0,
		0, 0, (n+f)/(f-n), 1,
		0, 0, -2*n*f/(f-n), 0
	];
}

function UpdateProjectionMatrix()
{
	var r = canvas.width / canvas.height;
	var n = (transZ - 100);
	const min_n = 0.001;
	if ( n < min_n ) n = min_n;
	var f = (transZ + 100);;
	var fov = 3.145 * 60 / 180;
	var s = 1 / Math.tan( fov/2 );
	perspectiveMatrix = [
		s/r, 0, 0, 0,
		0, s, 0, 0,
		0, 0, (n+f)/(f-n), 1,
		0, 0, -2*n*f/(f-n), 0
	];
}

function checkCollision(sphere1, sphere2) {
    const dx = sphere2.position.x - sphere1.position.x;
    const dy = sphere2.position.y - sphere1.position.y;
    const dz = sphere2.position.z - sphere1.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance < (sphere1.radius + sphere2.radius);
}

// Coefficient of restitution
var e = parseFloat(document.getElementById("restitution").value);

function handleCollision(sphere1, sphere2) {
    const dx = sphere2.position.x - sphere1.position.x;
    const dy = sphere2.position.y - sphere1.position.y;
    const dz = sphere2.position.z - sphere1.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Normal vector
    const normal = { x: dx / distance, y: dy / distance, z: dz / distance };

    // Relative velocity
    const relativeVelocity = {
        x: sphere2.velocity.x - sphere1.velocity.x,
        y: sphere2.velocity.y - sphere1.velocity.y,
        z: sphere2.velocity.z - sphere1.velocity.z
    };

    // Velocity component along the normal
    const velocityAlongNormal = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y + relativeVelocity.z * normal.z;

    // If spheres are moving away from each other, no collision response is needed
    if (velocityAlongNormal > 0) return;


    // Calculate impulse scalar
    const impulse = (-(1 + e) * velocityAlongNormal) / (1 / sphere1.mass + 1 / sphere2.mass);

    // Apply impulse to the velocities
    const impulseVector = { x: impulse * normal.x, y: impulse * normal.y, z: impulse * normal.z };
    
    sphere1.velocity.x -= (1 / sphere1.mass) * impulseVector.x;
    sphere1.velocity.y -= (1 / sphere1.mass) * impulseVector.y;
    sphere1.velocity.z -= (1 / sphere1.mass) * impulseVector.z;

    sphere2.velocity.x += (1 / sphere2.mass) * impulseVector.x;
    sphere2.velocity.y += (1 / sphere2.mass) * impulseVector.y;
    sphere2.velocity.z += (1 / sphere2.mass) * impulseVector.z;
}



function drawScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);
    //console.log("drawscene");
    sphereDrawers.forEach((sphereDrawer) => {
        sphereDrawer.draw(perspectiveMatrix);
    });
    var mvp = GetModelViewBox(0, 0, transZ, rotX, rotY);
    mvp = MatrixMult(perspectiveMatrix, mvp);
    boxDrawer.draw( mvp );
}

let dx, dy;
window.onload = function() {
	InitWebGL();
    lightView = new LightView();
	canvas.zoom = function( s ) {
		transZ *= s/canvas.height + 1;
		UpdateProjectionMatrix();
		drawScene();
	}
	canvas.onwheel = function() { canvas.zoom(0.3*event.deltaY); }
	canvas.onmousedown = function() {
		var cx = event.clientX;
		var cy = event.clientY;
		if ( event.ctrlKey ) {
			canvas.onmousemove = function() {
				canvas.zoom(5*(event.clientY - cy));
				cy = event.clientY;
			}
		} else {
			canvas.onmousemove = function() {
				rotY += (cx - event.clientX)/canvas.width*5;
				rotX += (cy - event.clientY)/canvas.height*5;
				cx = event.clientX;
				cy = event.clientY;
				UpdateProjectionMatrix();
				drawScene();
			}
		}
	}
	canvas.onmouseup = canvas.onmouseleave = function() {
		canvas.onmousemove = null;
	}

    document.getElementById('reset-button').addEventListener('click', function() {
        transZ = 3;
        rotX = 0;
        rotY = 0;
        UpdateProjectionMatrix();
        drawScene();
    });

    document.getElementById('play').addEventListener('click', function() {
        Animation(true);
    });

    document.getElementById('pause').addEventListener('click', function() {
        Animation(false);
    });

    document.getElementById('speed').addEventListener('input', function() {
        document.getElementById('speed-value').textContent = this.value;
        //reset the animation
        Animation(false);
        Animation(true);
    });

    document.getElementById('gravity').addEventListener('input', function() {
        document.getElementById('gravity-value').textContent = this.value;
    });

    document.getElementById('restitution').addEventListener('input', function() {
        document.getElementById('restitution-value').textContent = this.value;
        e = parseFloat(this.value);
    });

    document.getElementById('num_spheres').addEventListener('input', function() {
        num_spheres = this.value;
        document.getElementById('spheres_counter').textContent = num_spheres;
        
        Animation(false);
        InitWebGL();
        drawScene();
    });

	drawScene();
};
function WindowResize()
{
	UpdateCanvasSize();
	drawScene();
}

function simulationStep() {
    sphereDrawers.forEach((sphereDrawer, index) => {
        // Update position based on velocity
        sphereDrawer.position.x += sphereDrawer.velocity.x;
        sphereDrawer.position.y += sphereDrawer.velocity.y;
        sphereDrawer.position.z += sphereDrawer.velocity.z;
        
                                             // value of the gravity
        sphereDrawer.velocity.y -= 0.0001 * document.getElementById("gravity").value; 

        // Handle collisions with the box
        if (sphereDrawer.position.x - sphereDrawer.radius < -1 || sphereDrawer.position.x + sphereDrawer.radius > 1) {
            sphereDrawer.velocity.x *= -1 * e;
        }
        if (sphereDrawer.position.y - sphereDrawer.radius < -1 || sphereDrawer.position.y + sphereDrawer.radius > 1) {
            sphereDrawer.velocity.y *= -1 * e;
        }
        if (sphereDrawer.position.z - sphereDrawer.radius < -1 || sphereDrawer.position.z + sphereDrawer.radius > 1) {
            sphereDrawer.velocity.z *= -1 * e;
        }

        // Handle collisions with other spheres
        for (let j = index + 1; j < sphereDrawers.length; j++) {
            if (checkCollision(sphereDrawer, sphereDrawers[j])) {
                
                if(document.getElementById('sound').checked){
                   
                    const collisionSound = new Audio('collision.mp3');
                    collisionSound.play();
                }
                handleCollision(sphereDrawer, sphereDrawers[j]);
            }
        }
    });
    drawScene();
}

var timer;
function Animation( param )
{
    var multiplier = document.getElementById('speed').value;
    if ( param ) {
        timer = setInterval( function() {
            //perform the simulation step multiple times
                for(var i=0; i<multiplier; ++i) {
                    simulationStep();
                }
            }, 10
        );
        document.getElementById('pause').disabled = false;
        document.getElementById('play').disabled = true;
        document.getElementById('speed').disabled = false;
    } else {
        clearInterval( timer );
        document.getElementById('pause').disabled = true;
        document.getElementById('play').disabled = false;
        document.getElementById('speed').disabled = true;
    }
}