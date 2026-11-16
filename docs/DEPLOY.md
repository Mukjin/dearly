# 운영 사이트 소유 확인 태그 반영

운영 주소: https://wv1786969114656754.zaemit.ai/

이 저장소는 운영 사이트의 프런트엔드 스냅샷입니다. `git push`나 로컬 서버 재시작만으로 재밋 운영 사이트가 갱신되지 않습니다. 저장소에는 운영 사이트용 빌드·배포 명령이 없습니다.

## 추가할 내용

홈페이지가 서버에서 반환하는 HTML의 `<head>` 안에 다음 태그를 한 번 넣습니다. 로컬 파일 `site/index.html`에는 반영되어 있습니다.

```html
<meta name="trust-verify" content="trust-verify-3443bd6d7436cc015a29dec3567e7987">
```

## 운영 반영 결과

2026-11-17 (한국 시간), 관리자 로그인 세션을 통해 재밋의 `head_code` 설정에 위 태그를 저장했습니다. 기존 값은 비어 있었으며, 저장 전후 비교에서 변경된 설정 키는 `head_code` 하나였습니다.

저장 즉시 운영 HTML에 반영되었습니다. 별도의 에디터 게시 작업은 필요하지 않았습니다. 로그인 정보를 제외하고 캐시를 사용하지 않은 홈페이지 요청에서 HTTP 200과 `<head>` 안의 정확한 태그 1개를 확인했습니다. 이 설정은 사이트 공통 head에 적용됩니다.

## 운영 반영과 재배포

1. 재밋에 해당 사이트를 관리하는 계정으로 로그인하고, 주소가 `wv1786969114656754.zaemit.ai`인 기존 사이트를 선택합니다.
2. 재밋의 고급 삽입 코드 `head_code`에 태그를 저장합니다. 기존 head 코드가 있으면 보존하고, 이미 동일한 태그가 있으면 중복 추가하지 않습니다. 연결된 재밋 MCP에서는 `seo_setCode`의 `head_code` 항목으로 변경할 수 있습니다.
3. 이 메타 태그 설정은 저장 즉시 공개 HTML에 적용되므로 별도의 빌드나 `git push`, 에디터 재게시가 필요하지 않습니다. 일반 페이지 편집 내용의 재배포는 재밋 에디터 오른쪽 위 **저장&게시**를 사용합니다.
4. 아래 방법으로 운영 주소에서 내려오는 원본 HTML을 확인합니다. 브라우저 JavaScript가 실행된 후 DOM에만 삽입하는 방식은 피합니다.

이번에 사용한 관리자 API는 `GET /webadm/api/siteConfig/getSiteConfigDetail`로 현재 값을 읽고, `POST /webadm/api/seoManage/updateSeo`에 `head_code` 필드만 form-urlencoded 형식으로 보내는 방식입니다. 해당 사이트의 관리자 로그인 세션이 필요합니다. 기존 코드를 읽지 않고 덮어쓰지 마세요.

재밋 MCP가 연결된 환경에 전달할 요청:

> 기존 운영 사이트 https://wv1786969114656754.zaemit.ai/ 의 첫 페이지에서 서버가 반환하는 HTML의 head 안에 `<meta name="trust-verify" content="trust-verify-3443bd6d7436cc015a29dec3567e7987">`를 한 번 추가하고 운영에 반영해 주세요. 기존 head 항목과 본문은 보존하고, JavaScript로 동적 삽입하지 말아 주세요. 공개 URL의 원본 HTML에서 태그가 head 안에 있는지 확인해 주세요.

공식 MCP 연결 안내: https://mcp.zaemit.ai/

## 배포 결과 확인 (PowerShell)

```powershell
$response = Invoke-WebRequest -Uri 'https://wv1786969114656754.zaemit.ai/' -Headers @{ 'Cache-Control' = 'no-cache' }
$headHtml = [regex]::Match($response.Content, '(?is)<head\b[^>]*>(.*?)</head>').Groups[1].Value
$metaTags = [regex]::Matches($headHtml, '(?is)<meta\b[^>]*>')
$found = @($metaTags | Where-Object {
    $_.Value -match '\bname\s*=\s*["'']trust-verify["'']' -and
    $_.Value -match '\bcontent\s*=\s*["'']trust-verify-3443bd6d7436cc015a29dec3567e7987["'']'
})
if ($found.Count -ne 1) { throw '운영 HTML의 head에서 소유 확인 태그를 정확히 한 개 찾지 못했습니다.' }
'운영 HTML의 head에 소유 확인 태그가 있습니다.'
```

위 확인이 성공한 뒤 소유 확인 서비스에서 다시 검증합니다.
