/**
 * VR Rythym creator using Babylon.js's XR layer
 * 
 * Upon entering VR 3 spheres will start falling from 3 different locations around the user.
 * The user can grab one of the 3 types of drums located in front of them and position them under the spheres.
 * This way they can create physics-based rythyms.
 * 
 * Hand tracking and grabbing is also supported using the default select gesture.
 * 
 * Main grabbing is done using the pointer event system, but the squeeze component can also be used to grab the drums.
 * 
 * Make sure to enable sound when entering the scene.
 * 
 * Created by RaananW (https://twitter.com/RaananW)
 */

var createScene = async function () {

  let timeout;
  const mats = [];
  const positions = [];

  // This creates a basic Babylon Scene object (non-mesh)
  var scene = new BABYLON.Scene(engine);

  // This creates and positions a free camera (non-mesh)
  var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 2, 0), scene);

  // This targets the camera to scene origin
  camera.setTarget(new BABYLON.Vector3(0, 0, 1));

  // This attaches the camera to the canvas
  camera.attachControl(canvas, true);

  scene.activeCamera = camera;

  var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(0, -0.5, 1.0), scene);
  light.position = new BABYLON.Vector3(0, 5, -6);

  // enable physics
  scene.enablePhysics(undefined, new BABYLON.CannonJSPlugin(undefined, 80));

  // shadow generator
  const shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 32;

  const hl = new BABYLON.HighlightLayer("hl1", scene);

  // create the default environment
  const environment = scene.createDefaultEnvironment();


  // create 3 materials
  const mat1 = new BABYLON.StandardMaterial('mat1', scene);
  mat1.diffuseColor = BABYLON.Color3.Blue();
  const mat2 = new BABYLON.StandardMaterial('mat2', scene);
  mat2.diffuseColor = BABYLON.Color3.Yellow();
  const mat3 = new BABYLON.StandardMaterial('mat3', scene);
  mat3.diffuseColor = BABYLON.Color3.Red();
  mats.push(mat1, mat2, mat3);

  // the position from which the dropplets will fall
  positions.push(new BABYLON.Vector3(-0.5, 2, 0), new BABYLON.Vector3(0, 2, 0.5), new BABYLON.Vector3(0.5, 2, 0))

  // XR
  const xrHelper = await scene.createDefaultXRExperienceAsync({
      floorMeshes: [environment.ground],
      // we don't need no teleportation! (and education)
      disableTeleportation: true
  });

  xrHelper.pointerSelection.displayLaserPointer = false;
  xrHelper.pointerSelection.displaySelectionMesh = false;

  // optional hand support, where available
  const featureManager = xrHelper.baseExperience.featuresManager;
  featureManager.enableFeature(BABYLON.WebXRFeatureName.HAND_TRACKING, "latest", {
      xrInput: xrHelper.input,
  }, true, false);

  scene.onBeforeRenderObservable.add(() => {
      scene.getMeshesById('drop').forEach((drop) => {
          if (drop.position.y < -0.5) {
              drop.dispose();
          }
      })
  });

  const createDrop = (idx) => {
      const s = BABYLON.SphereBuilder.CreateSphere('drop', { diameter: 0.08 })
      s.material = mats[idx];
      s.physicsImpostor = new BABYLON.PhysicsImpostor(s, BABYLON.PhysicsImpostor.SphereImpostor, {
          mass: 0.5, friction: 0.01, restitution: 0.6
      });
      s.position.copyFrom(positions[idx]);
      // register a new collider with the drums
      s.physicsImpostor.registerOnPhysicsCollide(scene.getMeshesById('drum').map(m => m.physicsImpostor), (col, against) => {
          hl.addMesh(against.object, s.material.diffuseColor);
          setTimeout(() => {
              hl.removeMesh(against.object)
          }, 200)
      });
      shadowGenerator.addShadowCaster(s);
  }

  const createDrops = () => {

      // drop 1, on the left
      [0, 1, 2].forEach(createDrop);

      // 30 BPM!
      timeout = setTimeout(createDrops, 2000);
  }

  // this will clone the drum sample and will create a physics-enabled drum 
  const makeDrumsGreatAgain = (cloneFrom) => {
      const drumMesh = cloneFrom.clone('drum')
      shadowGenerator.addShadowCaster(drumMesh);
      drumMesh.id = 'drum';
      drumMesh.physicsImpostor = new BABYLON.PhysicsImpostor(drumMesh, cloneFrom.metadata.impostorType, { mass: 0, friction: 0.01, restitution: 0.6 });
      return drumMesh;
  }

  // start dropping spheres when the session starts
  xrHelper.baseExperience.sessionManager.onXRSessionInit.add(() => {
      createDrops();
  })

  // stop dropping spheres when the session ended
  xrHelper.baseExperience.sessionManager.onXRSessionEnded.add(() => {
      clearTimeout(timeout);
  });

  // three shapes of drums
  const drum1 = BABYLON.BoxBuilder.CreateBox('drumSample', { depth: 0.1, height: 0.2, width: 0.2 });
  drum1.position.set(0, 1, 0.3);
  drum1.metadata = { impostorType: BABYLON.PhysicsImpostor.BoxImpostor };
  const drum2 = BABYLON.SphereBuilder.CreateSphere('drumSample', { diameter: 0.2 });
  drum2.position.set(-0.3, 1, 0.3);
  drum2.metadata = { impostorType: BABYLON.PhysicsImpostor.SphereImpostor };

  drum3 = BABYLON.MeshBuilder.CreateCylinder('drumSample', { diameter: 0.2, height: 0.1 });
  drum3.position.set(0.3, 1, 0.3);
  drum3.metadata = { impostorType: BABYLON.PhysicsImpostor.CylinderImpostor };

  // are we grabbing?
  const checkGrab = (grab, grabbingMesh) => {
      if (grab) {
          // is a drum sample "grabbed"?
          [drum1, drum2, drum3].forEach((sample) => {
              if (sample.intersectsMesh(grabbingMesh)) {
                  // clone!
                  makeDrumsGreatAgain(sample);
              }
          });
          const drums = scene.getMeshesById('drum');
          // now check intersection with the other boxes
          drums.forEach((d) => {
              if (d.intersectsMesh(grabbingMesh)) {
                  hl.addMesh(d, BABYLON.Color3.Green());
                  d.setParent(grabbingMesh)
              }
          })
      } else {
          const drums = scene.getMeshesById('drum');
          drums.forEach((d) => {
              if (d.parent === grabbingMesh) {
                  hl.removeMesh(d);
                  d.setParent(null);
              }
          })
      }
  }
  // XR grab using the squeeze component, if available.
  xrHelper.input.onControllerAddedObservable.add((controller) => {
      controller.onMeshLoadedObservable.addOnce((rootMesh) => {
          shadowGenerator.addShadowCaster(rootMesh, true);
      });
      controller.onMotionControllerInitObservable.add(() => {
          const squeeze = controller.motionController.getComponentOfType("squeeze");
          // other component types can be added as well
          [squeeze].forEach((component) => {
              if (!component) {
                  return;
              }
              component.onButtonStateChangedObservable.add(() => {
                  if (component.changes.pressed) {
                      checkGrab(component.pressed, controller.pointer)
                  }
              })
          })
      });
  });

  // Pointer support for grabbing (using the main component).
  // this will also allow hand support (using the "select" gesture)
  scene.onPointerObservable.add((data) => {
      // get the pointer that triggered it
      const controller = xrHelper.pointerSelection.getXRControllerByPointerId(data.event.pointerId);
      if (controller) {
          if (data.type === BABYLON.PointerEventTypes.POINTERDOWN) {
              checkGrab(true, controller.pointer)
          } else if (data.type === BABYLON.PointerEventTypes.POINTERUP) {
              checkGrab(false, controller.pointer)
          }
      }
  }, BABYLON.PointerEventTypes.POINTERDOWN | BABYLON.PointerEventTypes.POINTERUP)

  // thou it probably won't happen, stay defensive and clear the timeout when the scene disposes
  scene.onDisposeObservable.add(() => {
      if (timeout) {
          clearTimeout(timeout);
      }
  });

  return scene;

};



