// 앱 설치를 위한 기본적인 서비스 워커 세팅
self.addEventListener('install', (event) => {
    console.log('[Service Worker] 설치 완료');
});

self.addEventListener('fetch', (event) => {
    // 현재는 네트워크 요청을 그대로 통과시킵니다.
});
