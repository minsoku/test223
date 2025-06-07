// 전역 변수들
let scene, camera, renderer, room;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let raycaster;
let intersected = [];
let tempMatrix = new THREE.Matrix4();

// 게임 상태
let gameState = {
    hasKey: false,
    doorLocked: true,
    gameComplete: false,
    interactables: []
};

// 게임 오브젝트들
let key, door, table, chest, exitDoor;

// 초기화
function init() {
    // 씬 생성
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x505050);

    // 카메라 생성
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 3);

    // 렌더러 생성
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('canvas'),
        antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    renderer.setAnimationLoop(animate);

    // VR 버튼 추가
    document.body.appendChild(VRButton.createButton(renderer));

    // 조명 설정
    setupLighting();

    // 방 생성
    createRoom();

    // 게임 오브젝트 생성
    createGameObjects();

    // 컨트롤러 설정
    setupControllers();

    // 레이캐스터 설정
    raycaster = new THREE.Raycaster();

    // 이벤트 리스너
    setupEventListeners();

    // UI 처리
    handleUI();
}

// 조명 설정
function setupLighting() {
    // 환경광
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // 포인트 라이트
    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 4, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    scene.add(pointLight);

    // 스팟 라이트
    const spotLight = new THREE.SpotLight(0xffffff, 0.8);
    spotLight.position.set(-3, 3, 3);
    spotLight.target.position.set(0, 0, 0);
    spotLight.castShadow = true;
    scene.add(spotLight);
    scene.add(spotLight.target);
}

// 방 생성
function createRoom() {
    const roomSize = 8;
    const wallHeight = 4;

    // 바닥
    const floorGeometry = new THREE.PlaneGeometry(roomSize, roomSize);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 벽들
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });

    // 뒷벽
    const backWall = createWall(roomSize, wallHeight, wallMaterial);
    backWall.position.z = -roomSize / 2;
    scene.add(backWall);

    // 좌측벽
    const leftWall = createWall(roomSize, wallHeight, wallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -roomSize / 2;
    scene.add(leftWall);

    // 우측벽
    const rightWall = createWall(roomSize, wallHeight, wallMaterial);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = roomSize / 2;
    scene.add(rightWall);

    // 천장
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(roomSize, roomSize),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight;
    scene.add(ceiling);
}

// 벽 생성 함수
function createWall(width, height, material) {
    const wallGeometry = new THREE.PlaneGeometry(width, height);
    const wall = new THREE.Mesh(wallGeometry, material);
    wall.position.y = height / 2;
    wall.receiveShadow = true;
    return wall;
}

// 게임 오브젝트 생성
function createGameObjects() {
    // 테이블
    const tableGeometry = new THREE.BoxGeometry(2, 0.1, 1);
    const tableMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(-2, 0.8, -1);
    table.castShadow = true;
    scene.add(table);

    // 테이블 다리들
    for (let i = 0; i < 4; i++) {
        const legGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.1);
        const leg = new THREE.Mesh(legGeometry, tableMaterial);
        const x = (i % 2) * 1.8 - 0.9;
        const z = Math.floor(i / 2) * 0.8 - 0.4;
        leg.position.set(-2 + x, 0.4, -1 + z);
        leg.castShadow = true;
        scene.add(leg);
    }

    // 상자 (열쇠가 들어있음)
    const chestGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.6);
    const chestMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    chest = new THREE.Mesh(chestGeometry, chestMaterial);
    chest.position.set(2, 0.25, -2);
    chest.castShadow = true;
    chest.userData = { type: 'chest', canInteract: true };
    scene.add(chest);
    gameState.interactables.push(chest);

    // 열쇠 (처음에는 숨겨져 있음)
    const keyGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
    const keyMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    key = new THREE.Mesh(keyGeometry, keyMaterial);
    key.position.set(2, 0.6, -2);
    key.visible = false;
    key.userData = { type: 'key', canInteract: true };
    scene.add(key);
    gameState.interactables.push(key);

    // 문
    const doorGeometry = new THREE.BoxGeometry(1.5, 3, 0.2);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 1.5, 3.9);
    door.castShadow = true;
    door.userData = { type: 'door', canInteract: true };
    scene.add(door);
    gameState.interactables.push(door);

    // 문 손잡이
    const handleGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
    const doorHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    doorHandle.position.set(0.6, 1.5, 4);
    scene.add(doorHandle);
}

// 컨트롤러 설정
function setupControllers() {
    // 컨트롤러 1
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    controller1.addEventListener('connected', function (event) {
        this.add(buildController(event.data));
    });
    controller1.addEventListener('disconnected', function () {
        this.remove(this.children[0]);
    });
    scene.add(controller1);

    // 컨트롤러 2
    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    controller2.addEventListener('connected', function (event) {
        this.add(buildController(event.data));
    });
    controller2.addEventListener('disconnected', function () {
        this.remove(this.children[0]);
    });
    scene.add(controller2);

    // 컨트롤러 그립 모델
    const controllerModelFactory = new XRControllerModelFactory();

    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    scene.add(controllerGrip1);

    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    scene.add(controllerGrip2);
}

// 컨트롤러 빌더
function buildController(data) {
    let geometry, material;

    switch (data.targetRayMode) {
        case 'tracked-pointer':
            geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));

            material = new THREE.LineBasicMaterial({ 
                vertexColors: true, 
                blending: THREE.AdditiveBlending 
            });

            return new THREE.Line(geometry, material);

        case 'gaze':
            geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1);
            material = new THREE.MeshBasicMaterial({ 
                opacity: 0.5, 
                transparent: true 
            });
            return new THREE.Mesh(geometry, material);
    }
}

// 컨트롤러 이벤트 핸들러
function onSelectStart(event) {
    const controller = event.target;
    const raycaster = new THREE.Raycaster();
    
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects(gameState.interactables, false);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        handleInteraction(intersectedObject);
    }
}

function onSelectEnd(event) {
    // 선택 종료 시 처리할 로직이 있다면 여기에 추가
}

// 상호작용 처리
function handleInteraction(object) {
    if (!object.userData.canInteract) return;

    switch (object.userData.type) {
        case 'chest':
            openChest();
            break;
        case 'key':
            collectKey();
            break;
        case 'door':
            tryOpenDoor();
            break;
    }
}

// 상자 열기
function openChest() {
    if (!key.visible) {
        key.visible = true;
        chest.userData.canInteract = false;
        
        // 상자 열기 애니메이션
        const openAnimation = () => {
            chest.rotation.x += 0.02;
            if (chest.rotation.x < Math.PI / 4) {
                requestAnimationFrame(openAnimation);
            }
        };
        openAnimation();
        
        showMessage("상자를 열었습니다! 황금 열쇠를 발견했어요!");
    }
}

// 열쇠 수집
function collectKey() {
    if (key.visible) {
        key.visible = false;
        gameState.hasKey = true;
        key.userData.canInteract = false;
        showMessage("황금 열쇠를 획득했습니다! 이제 문을 열 수 있어요!");
    }
}

// 문 열기 시도
function tryOpenDoor() {
    if (gameState.hasKey && gameState.doorLocked) {
        gameState.doorLocked = false;
        door.userData.canInteract = false;
        
        // 문 열기 애니메이션
        const openDoorAnimation = () => {
            door.rotation.y += 0.02;
            if (door.rotation.y < Math.PI / 2) {
                requestAnimationFrame(openDoorAnimation);
            } else {
                gameState.gameComplete = true;
                showMessage("축하합니다! 방탈출에 성공했습니다! 🎉");
            }
        };
        openDoorAnimation();
        
        showMessage("열쇠로 문을 열고 있습니다...");
    } else if (!gameState.hasKey) {
        showMessage("문이 잠겨있습니다. 열쇠를 찾아보세요!");
    }
}

// 메시지 표시
function showMessage(message) {
    // VR 환경에서 메시지를 3D 공간에 표시
    if (renderer.xr.isPresenting) {
        displayVRMessage(message);
    } else {
        // 일반 웹에서는 알림 사용
        alert(message);
    }
}

// VR 메시지 표시
function displayVRMessage(message) {
    // 기존 메시지 제거
    const existingMessage = scene.getObjectByName('vrMessage');
    if (existingMessage) {
        scene.remove(existingMessage);
    }

    // 텍스트 캔버스 생성
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 256;

    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = '48px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(message, canvas.width / 2, canvas.height / 2 + 16);

    // 텍스처로 변환
    const texture = new THREE.CanvasTexture(canvas);
    
    // 3D 텍스트 패널 생성
    const messageGeometry = new THREE.PlaneGeometry(4, 1);
    const messageMaterial = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true
    });
    const messagePanel = new THREE.Mesh(messageGeometry, messageMaterial);
    messagePanel.name = 'vrMessage';
    messagePanel.position.set(0, 2.5, -2);
    scene.add(messagePanel);

    // 3초 후 메시지 제거
    setTimeout(() => {
        if (scene.getObjectByName('vrMessage')) {
            scene.remove(messagePanel);
        }
    }, 3000);
}

// UI 처리
function handleUI() {
    const enterVRButton = document.getElementById('enter-vr');
    const ui = document.getElementById('ui');

    enterVRButton.addEventListener('click', () => {
        if (renderer.xr.isPresenting) {
            renderer.xr.getSession().end();
        } else {
            // VR 세션 시작 시도
            navigator.xr.requestSession('immersive-vr', {
                requiredFeatures: ['local-floor']
            }).then((session) => {
                renderer.xr.setSession(session);
                ui.classList.add('hidden');
                document.body.classList.add('vr-mode');
            }).catch((error) => {
                console.error('VR 세션을 시작할 수 없습니다:', error);
                alert('VR 헤드셋이 연결되어 있는지 확인해주세요.');
            });
        }
    });

    // VR 세션 종료 시 UI 다시 표시
    renderer.xr.addEventListener('sessionend', () => {
        ui.classList.remove('hidden');
        document.body.classList.remove('vr-mode');
    });
}

// 이벤트 리스너 설정
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize, false);
}

// 윈도우 리사이즈 처리
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 애니메이션 루프
function animate() {
    // 컨트롤러 레이캐스팅 업데이트
    if (controller1 && controller1.userData.isSelecting) {
        updateControllerRaycasting(controller1);
    }
    if (controller2 && controller2.userData.isSelecting) {
        updateControllerRaycasting(controller2);
    }

    // 렌더링
    renderer.render(scene, camera);
}

// 컨트롤러 레이캐스팅 업데이트
function updateControllerRaycasting(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects(gameState.interactables, false);

    if (intersects.length > 0) {
        if (intersected.indexOf(intersects[0].object) === -1) {
            intersected.push(intersects[0].object);
            intersects[0].object.material.emissive.setHex(0x444444);
        }
    } else {
        if (intersected.length > 0) {
            intersected[0].material.emissive.setHex(0x000000);
            intersected.splice(0, 1);
        }
    }
}

// 게임 시작
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// WebXR 지원 확인
if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
            console.log('WebXR VR이 지원됩니다!');
        } else {
            console.log('WebXR VR이 지원되지 않습니다.');
            document.getElementById('enter-vr').textContent = 'VR 미지원';
            document.getElementById('enter-vr').disabled = true;
        }
    });
} else {
    console.log('WebXR이 지원되지 않습니다.');
    document.getElementById('enter-vr').textContent = 'WebXR 미지원';
    document.getElementById('enter-vr').disabled = true;
} 