# PDFgawi

브라우저에서 PDF를 병합하고 페이지를 추출·분할하는 웹앱입니다. PDF 편집에는 pdf-lib, 페이지 미리보기에는 PDF.js를 사용합니다. 파일과 결과는 브라우저 메모리에서 처리하며 서버로 전송하지 않습니다.

## 실행

Node.js 24에서 아래 명령을 실행합니다.

~~~sh
npm ci
npm run dev
~~~

PDF를 선택하거나 파일 영역에 끌어다 놓습니다. 목록의 화살표로 병합 순서를 바꾸고, 파일 이름을 누르면 해당 PDF를 미리 볼 수 있습니다.

- **병합**은 두 개 이상의 PDF를 목록 순서대로 하나의 PDF로 저장합니다.
- **페이지 추출**은 선택한 PDF에서 입력한 순서대로 페이지를 모아 하나의 PDF로 저장합니다. 예를 들어 `4, 1-2`를 입력하면 4, 1, 2페이지 순서가 됩니다.
- **페이지별 분할**은 선택한 PDF를 페이지당 하나의 PDF로 나눠 ZIP으로 다운로드합니다. 범위를 비우면 전체 페이지를 사용합니다.

암호화된 PDF는 지원하지 않습니다. 큰 파일은 브라우저 메모리 한계의 영향을 받을 수 있습니다.

## 빌드와 Cloudflare Pages

~~~sh
npm run build
npm run preview
~~~

Cloudflare 대시보드의 **Workers & Pages → Create application → Pages → Import an existing Git repository**에서 이 프로젝트를 가져옵니다.

| 설정 | 값 |
| --- | --- |
| 프로덕션 브랜치 | 실제 기본 브랜치 (예시 `main`) |
| 빌드 명령 | `npm run build` |
| 빌드 출력 디렉터리 | `dist` |
| Node.js | `.node-version`에서 24 지정 |

PDF.js 워커와 렌더링 리소스는 빌드에 포함되어 같은 사이트에서 로드됩니다. [Cloudflare Pages 빌드 설정](https://developers.cloudflare.com/pages/configuration/build-configuration/)
