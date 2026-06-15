"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "next-themes";

export const Hero3DCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  
  // Keep track of mouse position
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Create Scene & Camera
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    // 2. Create Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Create Group for all interactive objects
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Helper: Closed Book Maker with Rounded Spine
    const createClosedBook = (color: number, w: number, th: number, d: number) => {
      const bookGroup = new THREE.Group();
      
      const coverMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0.02,
      });

      const pagesMat = new THREE.MeshStandardMaterial({
        color: 0xfdfbf7, // Creamy page color
        roughness: 0.95,
        metalness: 0.0,
      });

      // Top & Bottom cover box
      const topCover = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), coverMat);
      topCover.position.y = th / 2 - 0.02;
      bookGroup.add(topCover);

      const bottomCover = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), coverMat);
      bottomCover.position.y = -th / 2 + 0.02;
      bookGroup.add(bottomCover);

      // Spine Cylinder (on the left edge, x = -w/2)
      const spineRadius = th / 2;
      const spine = new THREE.Mesh(
        new THREE.CylinderGeometry(spineRadius, spineRadius, d, 24, 1, false, -Math.PI/2, Math.PI),
        coverMat
      );
      spine.position.x = -w / 2;
      spine.rotation.x = Math.PI / 2;
      bookGroup.add(spine);

      // Spine cap boxes to make the cylinder blend smoothly
      const spineCap = new THREE.Mesh(new THREE.BoxGeometry(0.04, th - 0.04, d), coverMat);
      spineCap.position.x = -w / 2 + 0.02;
      bookGroup.add(spineCap);

      // Pages block (recessed inside)
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.08, th - 0.08, d - 0.06),
        pagesMat
      );
      pages.position.set(0.04, 0, 0);
      bookGroup.add(pages);

      return bookGroup;
    };

    // Helper: Create extrude curves for open page sheets
    const createExtrudedPage = (shape: THREE.Shape, depth: number) => {
      const extrudeSettings = {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 2,
        steps: 1,
      };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.center(); // Center Z axis
      return geo;
    };

    // --- Create Stack of Books ---

    // 1. Blue Closed Book (Bottom Left)
    const blueBook = createClosedBook(0x4a90e2, 1.5, 0.28, 1.15);
    blueBook.position.set(-0.5, -1.0, -0.4);
    blueBook.rotation.set(0.12, 0.45, -0.15);
    mainGroup.add(blueBook);

    // 2. Yellow Closed Book (Bottom Right)
    const yellowBook = createClosedBook(0xf3cc4c, 1.6, 0.32, 1.25);
    yellowBook.position.set(0.4, -0.85, 0.1);
    yellowBook.rotation.set(-0.15, -0.35, -0.1);
    mainGroup.add(yellowBook);

    // 3. Pink Closed Book (Middle Left)
    const pinkBook = createClosedBook(0xf35d72, 1.2, 0.26, 0.95);
    pinkBook.position.set(-0.7, -0.35, 0.3);
    pinkBook.rotation.set(0.2, 0.75, 0.1);
    mainGroup.add(pinkBook);

    // Yellow sphere accent resting in front of pink book pages
    const accentSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.8 })
    );
    accentSphere.position.set(-0.85, -0.45, 0.9);
    mainGroup.add(accentSphere);


    // 4. Open Purple Book (Top Center)
    const openBookGroup = new THREE.Group();
    openBookGroup.position.set(-0.1, 0.45, 0.45);
    openBookGroup.rotation.set(0.3, -0.18, -0.22);
    mainGroup.add(openBookGroup);

    const purpleMat = new THREE.MeshStandardMaterial({
      color: 0x9b51e0, // Purple cover
      roughness: 0.9,
      metalness: 0.02,
    });

    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xfdfdfd,
      roughness: 0.95,
      metalness: 0.0,
    });

    // Open book cover wings
    const leftWingGroup = new THREE.Group();
    const rightWingGroup = new THREE.Group();
    openBookGroup.add(leftWingGroup);
    openBookGroup.add(rightWingGroup);

    // Cover boxes inside their hinge groups
    const coverLeft = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 1.35), purpleMat);
    coverLeft.position.x = -0.45;
    leftWingGroup.add(coverLeft);

    const coverRight = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 1.35), purpleMat);
    coverRight.position.x = 0.45;
    rightWingGroup.add(coverRight);

    // Open book spine center hinge joint
    const spineHinge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.35), purpleMat);
    openBookGroup.add(spineHinge);

    // Left Page solid base block
    const pageBaseLeft = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 1.28), pageMat);
    pageBaseLeft.position.set(-0.45, 0.065, 0);
    leftWingGroup.add(pageBaseLeft);

    // Right Page solid base block
    const pageBaseRight = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 1.28), pageMat);
    pageBaseRight.position.set(0.45, 0.065, 0);
    rightWingGroup.add(pageBaseRight);

    // Rotate left & right covers to create the open angle (V-shape)
    leftWingGroup.rotation.z = 0.16;
    rightWingGroup.rotation.z = -0.16;

    // Curved flipping page sheets (extruding 2D curves)
    
    // Page curve Left (curves gently upward)
    const leftCurve = new THREE.Shape();
    leftCurve.moveTo(0, 0.01);
    leftCurve.quadraticCurveTo(-0.4, 0.15, -0.84, 0.05);
    leftCurve.lineTo(-0.84, 0.01);
    leftCurve.quadraticCurveTo(-0.4, 0.11, 0, -0.01);
    leftCurve.closePath();

    const leftCurvedMesh = new THREE.Mesh(createExtrudedPage(leftCurve, 1.28), pageMat);
    leftCurvedMesh.position.set(-0.42, 0.14, 0);
    leftWingGroup.add(leftCurvedMesh);

    // Page curve Right (curves gently upward)
    const rightCurve = new THREE.Shape();
    rightCurve.moveTo(0, 0.01);
    rightCurve.quadraticCurveTo(0.4, 0.15, 0.84, 0.05);
    rightCurve.lineTo(0.84, 0.01);
    rightCurve.quadraticCurveTo(0.4, 0.11, 0, -0.01);
    rightCurve.closePath();

    const rightCurvedMesh = new THREE.Mesh(createExtrudedPage(rightCurve, 1.28), pageMat);
    rightCurvedMesh.position.set(0.42, 0.14, 0);
    rightWingGroup.add(rightCurvedMesh);

    // Middle flipping page 1 (arching higher on the left)
    const flipCurve1 = new THREE.Shape();
    flipCurve1.moveTo(0, 0.02);
    flipCurve1.quadraticCurveTo(-0.35, 0.38, -0.8, 0.22);
    flipCurve1.lineTo(-0.8, 0.18);
    flipCurve1.quadraticCurveTo(-0.35, 0.34, 0, 0.0);
    flipCurve1.closePath();

    const flipMesh1 = new THREE.Mesh(createExtrudedPage(flipCurve1, 1.26), pageMat);
    // Position slightly above spine center, tilting left
    flipMesh1.position.set(-0.38, 0.14, 0);
    flipMesh1.rotation.z = 0.05;
    openBookGroup.add(flipMesh1);

    // Middle flipping page 2 (fanning out on the right)
    const flipCurve2 = new THREE.Shape();
    flipCurve2.moveTo(0, 0.02);
    flipCurve2.quadraticCurveTo(0.35, 0.26, 0.8, 0.14);
    flipCurve2.lineTo(0.8, 0.1);
    flipCurve2.quadraticCurveTo(0.35, 0.22, 0, 0.0);
    flipCurve2.closePath();

    const flipMesh2 = new THREE.Mesh(createExtrudedPage(flipCurve2, 1.26), pageMat);
    flipMesh2.position.set(0.38, 0.12, 0);
    flipMesh2.rotation.z = -0.05;
    openBookGroup.add(flipMesh2);


    // --- Create Floating 3D Star ---
    const createStar = () => {
      const shape = new THREE.Shape();
      const spikes = 5;
      const outerRadius = 0.25;
      const innerRadius = 0.11;
      
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;
      
      shape.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        let x = Math.cos(rot) * outerRadius;
        const y = Math.sin(rot) * outerRadius;
        shape.lineTo(x, y);
        rot += step;
        
        x = Math.cos(rot) * innerRadius;
        const tempY = Math.sin(rot) * innerRadius;
        shape.lineTo(x, tempY);
        rot += step;
      }
      shape.closePath();
      
      const extrudeSettings = {
        depth: 0.08,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.015,
        bevelThickness: 0.015,
      };
      
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.center();
      return geo;
    };

    const starMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8cc1b, // Star gold
      roughness: 0.6,
      metalness: 0.1,
    });
    const floatingStar = new THREE.Mesh(createStar(), starMaterial);
    floatingStar.position.set(0.65, 1.25, 0.9);
    floatingStar.rotation.set(0.1, 0.1, -0.25);
    mainGroup.add(floatingStar);


    // --- Create Floating Curly Helical Ribbons ---
    const createRibbon = (color: number, heightScale: number) => {
      const points = [];
      const loops = 2.4;
      const radius = 0.18;
      const totalPoints = 35;
      
      for (let i = 0; i <= totalPoints; i++) {
        const t = i / totalPoints;
        const angle = t * Math.PI * 2 * loops;
        const x = Math.cos(angle) * radius;
        const y = (t - 0.5) * heightScale;
        const z = Math.sin(angle) * radius;
        points.push(new THREE.Vector3(x, y, z));
      }
      
      const curve = new THREE.CatmullRomCurve3(points);
      const geometry = new THREE.TubeGeometry(curve, 32, 0.03, 8, false);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.05,
      });
      return new THREE.Mesh(geometry, material);
    };

    // 1. Pink Ribbon (Top Left/Center)
    const pinkRibbon1 = createRibbon(0xf472b6, 0.5);
    pinkRibbon1.position.set(-0.35, 1.45, 0.25);
    pinkRibbon1.rotation.set(0.3, 0.2, 0.65);
    mainGroup.add(pinkRibbon1);

    // 2. Yellow Ribbon (Bottom Left)
    const yellowRibbon = createRibbon(0xf4d142, 0.55);
    yellowRibbon.position.set(-1.6, -0.85, 0.4);
    yellowRibbon.rotation.set(-0.5, 0.6, 0.2);
    mainGroup.add(yellowRibbon);

    // 3. Pink Ribbon (Bottom Right)
    const pinkRibbon2 = createRibbon(0xf472b6, 0.5);
    pinkRibbon2.position.set(1.15, -1.15, 0.6);
    pinkRibbon2.rotation.set(0.4, -0.5, -0.3);
    mainGroup.add(pinkRibbon2);


    // --- Create Floating Spheres ---
    const sphereGeo = new THREE.SphereGeometry(0.12, 24, 24);
    
    // 1. Blue Sphere (Left)
    const blueSphere = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshStandardMaterial({ color: 0x4a90e2, roughness: 0.8 })
    );
    blueSphere.position.set(-1.75, 0.55, 0.3);
    mainGroup.add(blueSphere);

    // 2. Purple Sphere (Bottom Right)
    const purpleSphere = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshStandardMaterial({ color: 0x9b51e0, roughness: 0.8 })
    );
    purpleSphere.position.set(1.3, -0.55, 0.7);
    mainGroup.add(purpleSphere);

    // 3. Red Sphere (Middle Right)
    const redSphere = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshStandardMaterial({ color: 0xf35d72, roughness: 0.8 })
    );
    redSphere.position.set(1.4, 0.1, 0.2);
    mainGroup.add(redSphere);


    // --- Lighting Setup ---
    const ambientLight = new THREE.AmbientLight(0xfff5ee, 0.55);
    scene.add(ambientLight);

    // Key Light (Warm, from top-right)
    const keyLight = new THREE.DirectionalLight(0xfffdfa, 0.95);
    keyLight.position.set(6, 9, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Fill Light (Soft bluish, from top-left)
    const fillLight = new THREE.DirectionalLight(0xe0e7ff, 0.45);
    fillLight.position.set(-6, 4, 3);
    scene.add(fillLight);

    // Rim/Contrast Light (soft pink tint from top-back-left)
    const rimLight = new THREE.DirectionalLight(0xfae8ff, 0.4);
    rimLight.position.set(-4, 5, -5);
    scene.add(rimLight);

    // Adjust lighting levels for dark mode
    const isDark = resolvedTheme === "dark";
    if (isDark) {
      ambientLight.color.setHex(0x2d2b55);
      keyLight.color.setHex(0xffffff);
      keyLight.intensity = 0.95;
      fillLight.color.setHex(0x818cf8);
      fillLight.intensity = 0.65;
    } else {
      ambientLight.color.setHex(0xfff5ee);
      keyLight.color.setHex(0xfffdfa);
      keyLight.intensity = 0.95;
      fillLight.color.setHex(0xe0e7ff);
      fillLight.intensity = 0.45;
    }

    // --- Interactions / Mouse movement ---
    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      mouseRef.current = { x, y };
    };

    window.addEventListener("mousemove", handleMouseMove);

    // --- Motion Preferences ---
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReduced = motionQuery.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    // --- Animation loop ---
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (prefersReduced) {
        // Static layout fallback - set objects to initial positions and stop rotating
        openBookGroup.position.y = 0.45;
        floatingStar.position.y = 1.25;
        blueBook.position.y = -1.0;
        yellowBook.position.y = -0.85;
        pinkBook.position.y = -0.35;
        accentSphere.position.y = -0.45;
        
        pinkRibbon1.position.y = 1.45;
        yellowRibbon.position.y = -0.85;
        pinkRibbon2.position.y = -1.15;
        
        blueSphere.position.y = 0.55;
        purpleSphere.position.y = -0.55;
        redSphere.position.y = 0.1;
        
        mainGroup.rotation.y = 0;
        mainGroup.rotation.x = 0;
      } else {
        const elapsedTime = clock.getElapsedTime();

        // 1. Gentle floating / bobbing animations
        // open book floats independently
        openBookGroup.position.y = 0.45 + Math.sin(elapsedTime * 1.3) * 0.08;
        
        // Floating star tilts and bobs
        floatingStar.position.y = 1.25 + Math.cos(elapsedTime * 1.5) * 0.08;
        floatingStar.rotation.y += 0.008;

        // Closed books float subtly in sync
        blueBook.position.y = -1.0 + Math.sin(elapsedTime * 0.9) * 0.03;
        yellowBook.position.y = -0.85 + Math.cos(elapsedTime * 0.8) * 0.02;
        pinkBook.position.y = -0.35 + Math.sin(elapsedTime * 1.1) * 0.03;
        accentSphere.position.y = -0.45 + Math.sin(elapsedTime * 1.1) * 0.03;

        // Ribbons wave/rotate
        pinkRibbon1.rotation.y += 0.005;
        pinkRibbon1.position.y = 1.45 + Math.sin(elapsedTime * 1.4) * 0.06;

        yellowRibbon.rotation.y -= 0.004;
        yellowRibbon.position.y = -0.85 + Math.cos(elapsedTime * 1.2) * 0.06;

        pinkRibbon2.rotation.y += 0.006;
        pinkRibbon2.position.y = -1.15 + Math.sin(elapsedTime * 1.6) * 0.08;

        // Spheres float
        blueSphere.position.y = 0.55 + Math.sin(elapsedTime * 1.1) * 0.08;
        purpleSphere.position.y = -0.55 + Math.cos(elapsedTime * 1.3) * 0.07;
        redSphere.position.y = 0.1 + Math.sin(elapsedTime * 1.5) * 0.09;

        // 2. Mouse tracking parallax (smooth lerp rotation)
        const targetRotationY = mouseRef.current.x * 0.28;
        const targetRotationX = -mouseRef.current.y * 0.28;

        mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.05;
        mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- Resize handling ---
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // --- Clean up ---
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      motionQuery.removeEventListener("change", handleMotionChange);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      
      // Remove canvas element from container
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [resolvedTheme]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-[380px] md:h-[450px] lg:h-[500px] flex items-center justify-center pointer-events-auto select-none"
    />
  );
};
