import { test } from "@playwright/test";

test("capture homepage and analysis result", async ({ page }) => {
  // 1. 메인 페이지 접속
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");

  // 초기 페이지 스크린샷
  await page.screenshot({ path: "screenshots/01-initial.png", fullPage: true });

  // 2. 긴 샘플 텍스트 입력
  const testText = `오늘 기준 재고 현황을 분석해주세요.

📌 분석 전 확인사항:
- 재고 스냅샷 데이터(ezadmin_stock_snapshot)의 최신 날짜를 확인해주세요.
- 전년 동기 데이터가 있는지 확인해주세요.

📌 TX 데이터 참고사항:
- ezadmin_stock_tx: 재고 입출고 이력 테이블
- job 타입별 재고 변동 방향:
  - in (입고), retin (반품입고): stock += qty (재고 증가)
  - trans (배송처리), out (출고): stock -= qty (재고 감소)
  - arrange (조정): qty 값 그대로 적용
- 스냅샷과 TX 정합성: 전일 스냅샷 + TX 변동 = 당일 스냅샷 (100% 일치)

## 1. 재고 현황 요약
- 전체 SKU 수, 총 재고 수량
- 정상 재고 vs 불량 재고 비율
- 접수/송장 대기 수량 (ready_trans_stock)

## 2. 전년 동기 대비 분석
- 전체 재고 수량 비교
- SKU별 재고 수준 변화
- 재고 회전율 변화 (판매 데이터 연계)

## 3. 시즌별 재고 분석
현재 시점의 계절성을 고려한 분석:
- 현재 시즌에 맞는 상품 재고 적정성
- 다가오는 시즌 대비 재고 준비 상태
- 시즌 지난 상품의 과잉 재고 여부

## 4. 입고 이력 분석 (최근 30일)
- 정기 입고 (in) 현황
- 반품 입고 (retin) 현황
- 주로 입고되는 요일
- 평균 입고 주기 (상품별)
- 최근 입고 트렌드 (증가/감소)

## 5. 🚨 입고 필요 상품
📌 계산 기준:
- 소진예상일 = 현재고 ÷ 일평균판매량
- 입고마감 = 소진예상일 - 안전재고(7일)

## 6. ⚠️ 재고 문제 상품
### 과잉 재고 (90일 이상 판매 예상)
- 재고 회전이 느린 상품 TOP 10
- 추천 액션: 할인/번들/프로모션 제안

### 품절 임박 (7일 이내 소진)
- 긴급 발주 필요 상품 목록

### 데드 스톡 (30일간 판매 없음)
- 판매가 전혀 없는 재고 상품

## 7. 주간 재고 추이 (최근 7일)
재고 증감 추이와 이상 패턴 감지

## 8. 오늘의 재고 관리 액션 아이템
우선순위별 정리:
1. 🔴 긴급 (즉시 조치 필요)
2. 🟡 주의 (금주 내 조치)
3. 🟢 참고 (모니터링 필요)`;

  await page.locator("textarea").fill(testText);

  // 텍스트 입력 후 스크린샷
  await page.screenshot({
    path: "screenshots/02-text-entered.png",
    fullPage: true,
  });

  // 3. 분석하기 버튼 클릭
  await page.locator("button", { hasText: "분석하기" }).click();

  // 로딩 상태 스크린샷
  await page.screenshot({ path: "screenshots/03-loading.png", fullPage: true });

  // 4. 결과 대기 (최대 120초)
  await page.waitForSelector(".heatmap-container", { timeout: 120000 });

  // 결과 스크린샷
  await page.screenshot({ path: "screenshots/04-result.png", fullPage: true });
});
