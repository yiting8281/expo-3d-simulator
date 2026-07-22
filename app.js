let scene, camera, renderer;
let floor, gridHelper;
let orbitControls, dragControls;

// 儲存所有可拖曳、管理的展具物件陣列
let draggableObjects = [];
// 目前被滑鼠選取的物件
let selectedObject = null;

// 定義吸附單位：0.5 代表每 50 公分吸附一次，若要嚴格按 1 公尺可改為 1
const SNAP_UNIT = 0.5; 

function init() {
    const container = document.getElementById('canvas-container');

    // 1. 場景與相機
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 10);
    camera.lookAt(0, 0, 0);

    // 2. 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // 3. 視角控制器 (改用滑鼠右鍵旋轉場景，避免跟左鍵拖曳物件衝突)
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.mouseButtons = {
        LEFT: THREE.MOUSE.NONE,      // 禁用左鍵旋轉場景，留給拖曳物件用
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE    // 改用右鍵旋轉場景
    };

    // 4. 燈光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // 5. 建立 6m x 6m 展場地板
    createExhibitionFloor(6, 6);

    // 6. 初始化拖曳控制器
    initDragControls();

    // 7. 綁定 UI 與鍵盤事件
    document.getElementById('add-btn').addEventListener('click', createCabinet);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onWindowResize);

    // 一開始先預設放一個方塊在場中央
    createCabinet();

    animate();
}

// 建立展場地板與格線
function createExhibitionFloor(width, length) {
    const floorGeo = new THREE.PlaneGeometry(width, length);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
    floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 灰色大格線，紅色軸線
    gridHelper = new THREE.GridHelper(width, width, 0xff4444, 0x555555);
    gridHelper.position.y = 0.001; 
    scene.add(gridHelper);
}

// 創建一個代表展櫃的方塊 (長 120cm = 1.2, 寬 45cm = 0.45, 高 90cm = 0.9)
function createCabinet() {
    const w = 1.2;
    const d = 0.45;
    const h = 0.9;

    const geometry = new THREE.BoxGeometry(w, h, d);
    // 使用 MeshStandardMaterial 配合燈光才有立體陰影感
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x007acc, 
        roughness: 0.4
    });
    const cube = new THREE.Mesh(geometry, material);

    // 讓方塊底部剛好貼在地面上 (Y 軸位置 = 高度的一半)
    cube.position.set(0, h / 2, 0);
    
    // 自訂屬性，方便未來識別與記錄高度
    cube.userData = { type: 'cabinet', height: h };

    scene.add(cube);
    draggableObjects.push(cube);

    // 新增後自動選取它
    selectObject(cube);

    // 更新拖曳控制器的監聽清單
    dragControls.getObjects().length = 0;
    draggableObjects.forEach(obj => dragControls.getObjects().push(obj));
}

// 初始化拖曳邏輯與格線吸附
function initDragControls() {
    dragControls = new THREE.DragControls(draggableObjects, camera, renderer.domElement);

    // 開始拖曳時：暫停場景視角旋轉，並高亮物件
    dragControls.addEventListener('dragstart', function (event) {
        orbitControls.enabled = false;
        selectObject(event.object);
    });

    // 拖曳過程中：即時計算並吸附格線，且確保 Y 軸（高度）固定在地面上
    dragControls.addEventListener('drag', function (event) {
        const obj = event.object;
        
        // X 軸與 Z 軸自動吸附指定的單位 (如每 0.5m 一格)
        obj.position.x = Math.round(obj.position.x / SNAP_UNIT) * SNAP_UNIT;
        obj.position.z = Math.round(obj.position.z / SNAP_UNIT) * SNAP_UNIT;
        
        // 強制 Y 軸保持在地面上 (高度的一半)
        obj.position.y = obj.userData.height / 2;
    });

    // 結束拖曳時：恢復場景視角控制
    dragControls.addEventListener('dragend', function (event) {
        orbitControls.enabled = true;
    });
}

// 選取物件的視覺處理
function selectObject(obj) {
    // 先把前一個選取的變回原色
    if (selectedObject) {
        selectedObject.material.color.setHex(0x007acc);
    }
    
    selectedObject = obj;
    
    if (selectedObject) {
        // 選中的物件變成橘黃色高亮
        selectedObject.material.color.setHex(0xffaa00);
        document.getElementById('status').innerText = `目前選取：${selectedObject.userData.type}`;
    } else {
        document.getElementById('status').innerText = `目前選取：無`;
    }
}

// 處理鍵盤操作：旋轉、複製、刪除
function onKeyDown(event) {
    if (!selectedObject) return;

    switch (event.key.toLowerCase()) {
        case 'r': // 旋轉 90 度
            selectedObject.rotation.y += Math.PI / 2;
            break;
            
        case 'delete': // 刪除物件
        case 'backspace':
            scene.remove(selectedObject);
            draggableObjects = draggableObjects.filter(o => o !== selectedObject);
            // 重新整理拖曳清單
            dragControls.getObjects().length = 0;
            draggableObjects.forEach(obj => dragControls.getObjects().push(obj));
            selectObject(null);
            break;

        case 'c': // 複製物件
            const w = selectedObject.geometry.parameters.width;
            const h = selectedObject.geometry.parameters.height;
            const d = selectedObject.geometry.parameters.depth;
            
            const cloneGeo = new THREE.BoxGeometry(w, h, d);
            const cloneMat = new THREE.MeshStandardMaterial({ color: 0x007acc });
            const clone = new THREE.Mesh(cloneGeo, cloneMat);
            
            // 複製位置與旋轉，並稍微偏移一點避免完全重疊
            clone.position.copy(selectedObject.position);
            clone.position.x += SNAP_UNIT; 
            clone.rotation.copy(selectedObject.rotation);
            clone.userData = { ...selectedObject.userData };

            scene.add(clone);
            draggableObjects.push(clone);
            
            // 重新更新拖曳清單並選取新物件
            dragControls.getObjects().length = 0;
            draggableObjects.forEach(obj => dragControls.getObjects().push(obj));
            selectObject(clone);
            break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}

// 初始化啟動
init();