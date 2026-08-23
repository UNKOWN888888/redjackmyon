# BlackjackT GitHub 로더

GitHub 저장소: [UNKOWN888888/redjackmyon](https://github.com/UNKOWN888888/redjackmyon)

수정 가능한 원본은 `src/partials`에 두고, GitHub에는 빌드된 `dist/blackjackT.user.js`를 함께 올립니다. Tampermonkey에는 전체 스크립트 대신 `loader/blackjackT-loader.user.js`만 설치합니다.

로더는 검증된 마지막 스크립트를 즉시 실행하고 GitHub 최신본은 백그라운드에서 확인합니다. GitHub 연결에 실패해도 마지막 정상 캐시가 있으면 자동화는 계속 실행됩니다.

## 최초 설치

1. 이 폴더에서 `npm run github:prepare`를 실행합니다.
2. 이 프로젝트 전체를 [redjackmyon](https://github.com/UNKOWN888888/redjackmyon)의 `main` 브랜치에 올립니다. `dist/blackjackT.user.js` 파일도 반드시 포함해야 합니다.
3. [GitHub Raw 로더](https://raw.githubusercontent.com/UNKOWN888888/redjackmyon/main/loader/blackjackT-loader.user.js)를 Tampermonkey에 설치합니다.
4. 다운로드 폴더의 로더를 설치해도 기본 저장소가 `UNKOWN888888/redjackmyon`으로 설정되어 별도 주소 입력 없이 실행됩니다.
5. 상태창 헤더에 스크립트 버전과 `GitHub 원격` 또는 `GitHub 캐시`가 표시되는지 확인합니다.

비공개 저장소는 로그인 토큰 없이는 raw 파일을 읽을 수 없습니다. 토큰을 userscript에 넣는 것은 계정 유출 위험이 있으므로 이 로더는 공개 저장소만 사용합니다.

## 이후 수정과 배포

1. 필요한 `src/partials/*.js` 파일을 수정합니다.
2. `npm run verify`를 실행합니다. 이 명령이 `dist/blackjackT.user.js`를 다시 만들고 전체 회귀 검사를 수행합니다.
3. 변경된 원본, 테스트, `dist/blackjackT.user.js`를 GitHub에 올립니다.
4. Tampermonkey 메뉴에서 `GitHub 최신본 받기`를 누른 뒤 게임을 새로고침합니다.

일반 새로고침에서도 캐시를 즉시 실행한 뒤 최신본을 받습니다. 이 경우 새 버전은 상태창 헤더에 `업데이트 v... 대기`로 표시되고 다음 새로고침에 적용됩니다.

## 최근 실행 로그

- 상태창의 `최근 로그 내보내기`는 최근 24시간 내 실행 로그를 최대 500건까지 JSON 파일로 저장합니다.
- 로그는 페이지 새로고침 후에도 유지되며 `recentExecutionLogs` 항목에 오래된 기록부터 시간순으로 들어갑니다.
- 로더 v2.0.6 이상에서는 Tampermonkey 다운로드 기능을 사용합니다. 이전 로더에서는 브라우저 다운로드를 요청하고 같은 JSON을 클립보드에도 복사합니다.
- 버튼에는 저장 중, 완료 건수 또는 실패 상태가 표시됩니다.

## 좌석 칩 클릭 검증

- 이미 선택된 칩은 좌석 클릭 재시도 전에 다시 누르지 않습니다. 칩 선택 애니메이션이 반복 초기화되어 좌석 클릭이 무시되는 현상을 방지합니다.
- 좌석 클릭은 현재 좌석 범위 안에서 실제로 화면에 맞은 요소를 우선하며, 금액 변화가 검증된 뒤에만 다음 칩으로 진행합니다.

## 주요 명령

- `npm run build`: `dist/blackjackT.user.js` 생성
- `npm run verify`: 문법 및 전체 회귀 검사
- `npm run github:prepare`: 전체 검사 후 Tampermonkey 로더를 다운로드 폴더에 생성
- `npm run install`: Tampermonkey 로더만 다운로드 폴더에 생성
- `npm run install:direct`: GitHub 없이 전체 스크립트를 `C:/Users/kakao/Downloads/blackjackT.txt`에 생성
- `npm run dev`: 원본 변경을 감시하고 직접 설치 파일을 자동 재생성

## Tampermonkey 메뉴

- `GitHub 스크립트 주소 설정`: 저장소 또는 raw 파일 주소 변경
- `GitHub 최신본 받기`: 최신 파일을 즉시 캐시에 저장
- `GitHub 캐시 삭제`: 저장된 원격 스크립트 제거

## 파일 역할

- `src/partials/06-chips.js`: 칩 감지와 금액 조합
- `src/partials/07-seats.js`: 좌석 점유·내 좌석·빈자리 판독
- `src/partials/09-betting-clicks.js`: 칩 선택, 좌석 클릭, 베팅 검증
- `src/partials/11-setup-bet.js`: 착석 및 베팅 전체 흐름
- `src/partials/14-autoplay-rearm.js`: 자동베팅 시작과 기준 미만 보충
- `src/partials/18-ui.js`: 상태창
- `loader/blackjackT-loader.user.js`: GitHub 원격 로더

`dist/blackjackT.user.js`와 다운로드 폴더의 생성 파일은 직접 수정하지 않습니다.
