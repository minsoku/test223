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

    enterVRButton.addEventListener('click', async (event) => {
        logToScreen('🎯 VR 버튼이 클릭되었습니다!', 'info');
        
        // 이벤트 전파 방지
        event.preventDefault();
        event.stopPropagation();
        
        // 로딩 표시
        enterVRButton.textContent = '연결 중...';
        enterVRButton.disabled = true;
        
        // 추가 상태 확인
        logToScreen(`🔧 navigator.xr 상태: ${!!navigator.xr}`, 'info');
        logToScreen(`🔧 renderer.xr 상태: ${!!renderer.xr}`, 'info');
        logToScreen(`🔧 현재 VR 세션: ${renderer.xr.isPresenting}`, 'info');
        
        try {
            // WebXR 지원 확인
            if (!navigator.xr) {
                throw new Error('이 브라우저는 WebXR을 지원하지 않습니다.');
            }
            
            console.log('WebXR API가 사용 가능합니다.');
            
            // VR 세션 지원 확인
            const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
            if (!isSupported) {
                throw new Error('이 디바이스는 VR 세션을 지원하지 않습니다.');
            }
            
            logToScreen('🚀 VR 세션이 지원됩니다. 세션을 요청합니다...', 'success');
            
            // VR 디바이스 감지 확인
            logToScreen('🔍 VR 디바이스 감지 중...', 'info');
            
            // 사용자 제스처 확인
            if (!event.isTrusted) {
                logToScreen('⚠️ 사용자 제스처가 아닙니다.', 'warning');
            }
            
            // 추가 권한 확인
            try {
                const permissions = await navigator.permissions.query({name: 'xr-spatial-tracking'});
                logToScreen(`🔐 XR 권한 상태: ${permissions.state}`, 'info');
            } catch (permError) {
                logToScreen(`🔐 XR 권한 확인 불가: ${permError.message}`, 'warning');
            }
            
            // 여러 옵션으로 VR 세션 시도
            let session = null;
            
            // 1차 시도: local-floor 기능 포함
            try {
                logToScreen('🔄 1차 시도: local-floor 기능으로 VR 세션 요청...', 'info');
                session = await navigator.xr.requestSession('immersive-vr', {
                    requiredFeatures: ['local-floor']
                });
                logToScreen('✅ local-floor 기능으로 VR 세션 성공!', 'success');
            } catch (e) {
                logToScreen(`❌ local-floor 기능 실패: ${e.message}`, 'error');
                logToScreen(`📋 오류 유형: ${e.name}`, 'warning');
                
                // 2차 시도: 기본 옵션만
                try {
                    logToScreen('🔄 2차 시도: 기본 옵션으로 VR 세션 요청...', 'info');
                    session = await navigator.xr.requestSession('immersive-vr');
                    logToScreen('✅ 기본 옵션으로 VR 세션 성공!', 'success');
                } catch (e2) {
                    logToScreen(`❌ 기본 옵션도 실패: ${e2.message}`, 'error');
                    logToScreen(`📋 오류 유형: ${e2.name}`, 'warning');
                    
                    // 3차 시도: 다른 옵션들
                    try {
                        logToScreen('🔄 3차 시도: 최소 옵션으로 VR 세션 요청...', 'info');
                        session = await navigator.xr.requestSession('immersive-vr', {
                            optionalFeatures: ['local-floor', 'bounded-floor']
                        });
                        logToScreen('✅ 최소 옵션으로 VR 세션 성공!', 'success');
                    } catch (e3) {
                        logToScreen(`❌ 모든 시도 실패: ${e3.message}`, 'error');
                        logToScreen(`📋 최종 오류 유형: ${e3.name}`, 'error');
                        
                        // 상세한 오류 정보 제공
                        if (e3.name === 'NotSupportedError') {
                            throw new Error('VR 헤드셋이 감지되지 않습니다. 헤드셋이 켜져있고 브라우저와 연결되어 있는지 확인하세요.');
                        } else if (e3.name === 'NotAllowedError') {
                            throw new Error('VR 접근이 거부되었습니다. 브라우저에서 VR 권한을 허용해주세요.');
                        } else if (e3.name === 'SecurityError') {
                            throw new Error('보안 오류입니다. HTTPS 연결을 확인하세요.');
                        } else {
                            throw new Error('VR 세션을 시작할 수 없습니다: ' + e3.message);
                        }
                    }
                }
            }
            
            if (session) {
                logToScreen('🎉 VR 세션이 성공적으로 생성되었습니다!', 'success');
                
                // 렌더러에 세션 설정
                await renderer.xr.setSession(session);
                logToScreen('🔧 렌더러에 VR 세션이 설정되었습니다.', 'success');
                
                // UI 숨기기
                ui.classList.add('hidden');
                document.body.classList.add('vr-mode');
                
                logToScreen('🚀 VR 모드가 시작되었습니다!', 'success');
                showMessage('VR 모드가 시작되었습니다! 컨트롤러를 사용해 게임을 즐기세요!');
            }
            
        } catch (error) {
            logToScreen(`💥 VR 세션 시작 오류: ${error.message}`, 'error');
            logToScreen(`📋 오류 유형: ${error.name}`, 'error');
            
            // 구체적인 오류 메시지 제공
            let errorMessage = 'VR 모드를 시작할 수 없습니다. ';
            
            if (error.message.includes('not supported')) {
                errorMessage += '브라우저나 디바이스가 WebXR을 지원하지 않습니다.';
            } else if (error.message.includes('NotSupportedError')) {
                errorMessage += 'VR 헤드셋이 연결되어 있는지 확인하세요.';
            } else if (error.message.includes('SecurityError')) {
                errorMessage += 'HTTPS 연결이 필요합니다.';
            } else if (error.message.includes('NotAllowedError')) {
                errorMessage += 'VR 권한이 거부되었습니다.';
            } else {
                errorMessage += error.message;
            }
            
            showMessage(errorMessage);
            
            // 버튼 상태 복원
            enterVRButton.textContent = 'VR 모드 시작';
            enterVRButton.disabled = false;
        }
    });

    // VR 세션 종료 시 UI 다시 표시
    renderer.xr.addEventListener('sessionend', () => {
        logToScreen('👋 VR 세션이 종료되었습니다.', 'info');
        ui.classList.remove('hidden');
        document.body.classList.remove('vr-mode');
        enterVRButton.textContent = 'VR 모드 시작';
        enterVRButton.disabled = false;
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

// 화면 로그 함수
function logToScreen(message, type = 'info') {
    const logContent = document.getElementById('log-content');
    if (!logContent) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span> ${message}
    `;
    
    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
    
    // 최대 50개 로그만 유지
    while (logContent.children.length > 50) {
        logContent.removeChild(logContent.firstChild);
    }
    
    // 콘솔에도 출력 (가능한 경우)
    console.log(`[${timestamp}] ${message}`);
}

// 로그 지우기 함수
function clearLiveLog() {
    const logContent = document.getElementById('log-content');
    if (logContent) {
        logContent.innerHTML = '';
    }
}

// 전역 함수로 만들기 (HTML에서 호출 가능)
window.clearLiveLog = clearLiveLog;

// 디버그 정보 업데이트
function updateDebugInfo() {
    // 브라우저 정보 업데이트
    const browserInfo = document.getElementById('browser-info');
    if (browserInfo) {
        const isChrome = navigator.userAgent.includes('Chrome');
        const isEdge = navigator.userAgent.includes('Edg');
        const isFirefox = navigator.userAgent.includes('Firefox');
        
        let browserName = 'Unknown';
        if (isChrome && !isEdge) browserName = 'Chrome';
        else if (isEdge) browserName = 'Edge';
        else if (isFirefox) browserName = 'Firefox';
        
        browserInfo.textContent = browserName;
    }
    
    // 프로토콜 정보 업데이트
    const protocolInfo = document.getElementById('protocol-info');
    if (protocolInfo) {
        const protocol = window.location.protocol;
        const isSecure = protocol === 'https:' || window.location.hostname === 'localhost';
        protocolInfo.textContent = protocol + (isSecure ? ' ✅' : ' ❌ (HTTPS 필요)');
    }
}

// WebXR 지원 확인 및 초기화
async function checkWebXRSupport() {
    const enterVRButton = document.getElementById('enter-vr');
    const webxrStatus = document.getElementById('webxr-status');
    const vrDeviceStatus = document.getElementById('vr-device-status');
    
    logToScreen('🔍 WebXR 지원 상태를 확인합니다...', 'info');
    
    // 디버그 정보 업데이트
    updateDebugInfo();
    
    // 기본 WebXR API 확인
    if (!navigator.xr) {
        logToScreen('❌ navigator.xr이 없습니다.', 'error');
        enterVRButton.textContent = 'WebXR 미지원';
        enterVRButton.disabled = true;
        if (webxrStatus) webxrStatus.textContent = '❌ 미지원';
        if (vrDeviceStatus) vrDeviceStatus.textContent = '❌ WebXR 없음';
        return;
    }
    
    logToScreen('✅ navigator.xr이 사용 가능합니다.', 'success');
    if (webxrStatus) webxrStatus.textContent = '✅ 사용 가능';
    
    try {
        // VR 세션 지원 확인
        const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
        
        if (isSupported) {
            logToScreen('✅ VR 세션이 지원됩니다!', 'success');
            enterVRButton.textContent = 'VR 모드 시작';
            enterVRButton.disabled = false;
            if (vrDeviceStatus) vrDeviceStatus.textContent = '✅ VR 헤드셋 연결됨';
            
            // 추가 디버깅 정보
            const browserName = navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                               navigator.userAgent.includes('Edge') ? 'Edge' : 'Other';
            logToScreen(`📱 브라우저: ${browserName}`, 'info');
            logToScreen(`🔒 프로토콜: ${window.location.protocol}`, 'info');
            
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                logToScreen('⚠️ HTTPS가 아닙니다. WebXR은 HTTPS에서만 작동합니다.', 'warning');
                showMessage('⚠️ HTTPS 연결이 필요합니다. localhost에서 테스트하거나 HTTPS 서버를 사용하세요.');
            }
            
        } else {
            logToScreen('❌ VR 세션이 지원되지 않습니다.', 'error');
            enterVRButton.textContent = 'VR 헤드셋 필요';
            enterVRButton.disabled = true;
            if (vrDeviceStatus) vrDeviceStatus.textContent = '❌ VR 헤드셋 없음';
            showMessage('VR 헤드셋이 연결되어 있는지 확인하고 페이지를 새로고침하세요.');
        }
        
    } catch (error) {
        logToScreen(`❌ VR 지원 확인 중 오류: ${error.message}`, 'error');
        enterVRButton.textContent = 'VR 확인 실패';
        enterVRButton.disabled = true;
        if (vrDeviceStatus) vrDeviceStatus.textContent = '❌ 확인 실패: ' + error.message;
        showMessage('VR 지원 확인 중 오류가 발생했습니다: ' + error.message);
    }
}

// 페이지 로드 시 WebXR 지원 확인
document.addEventListener('DOMContentLoaded', () => {
    // 약간의 지연 후 확인 (DOM이 완전히 로드되도록)
    setTimeout(checkWebXRSupport, 1000);
}); 