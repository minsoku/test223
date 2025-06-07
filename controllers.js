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
        // 일반 웹에서는 콘솔 로그 사용
        console.log(message);
        
        // 간단한 알림 팝업 생성
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 10000;
            font-size: 16px;
            max-width: 300px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
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

    enterVRButton.addEventListener('click', async () => {
        try {
            if (navigator.xr) {
                const session = await navigator.xr.requestSession('immersive-vr', {
                    requiredFeatures: ['local-floor']
                });
                
                await renderer.xr.setSession(session);
                ui.classList.add('hidden');
                document.body.classList.add('vr-mode');
            } else {
                throw new Error('WebXR not supported');
            }
        } catch (error) {
            console.error('VR 세션을 시작할 수 없습니다:', error);
            showMessage('VR 헤드셋이 연결되어 있는지 확인해주세요.');
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