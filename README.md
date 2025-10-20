# 會診回覆範本

一個純前端的範本填寫工具，以靜態 JSON 描述病歷模板，於瀏覽器呈現並支援區塊或全份複製。所有資源皆為靜態檔案，部署在任意靜態主機或以簡易 HTTP 伺服器開啟 `index.html` 即可使用。

---

## 目錄總覽

```
.
├── index.html          # 主頁面及欄位模板
├── script.js           # 動態載入、渲染、複製邏輯
├── styles.css          # 版面與元件樣式
└── templates
    ├── templates.json  # 範本清單索引
    ├── ERCP.json       # 範本實例（可自行新增）
    └── FB.json
```

---

## 範本索引 (`templates/templates.json`)

```json
{
  "templates": [
    { "name": "Choose a template" },
    { "name": "ERCP", "file": "ERCP.json" },
    { "name": "Foreign body removal", "file": "FB.json" },
    { "name": "UGI bleeding", "file": "UGIB.json" }
  ]
}
```

- `name`：顯示在下拉選單的文字。
- `file`：對應 `templates/` 目錄下的範本檔。

---

## 範本檔案結構

每個範本 JSON 需包含 `name`（可選）與 `sections`。`sections` 是一個物件，鍵固定為 `S` / `O` / `A+P`，值為欄位陣列：

```json
{
  "name": "範例範本",
  "sections": {
    "S": [
      { "type": "text", "value": "主觀資料 (Subjective)" },
      {
        "type": "input",
        "id": "chief",
        "label": "主訴",
        "placeholder": "請輸入主訴",
        "value": "Abdominal pain",
        "prefix": "Chief complaint: ",
        "suffix": "",
        "indent": 0
      }
    ],
    "O": [],
    "A+P": []
  }
}
```

每個欄位為物件，至少需指定 `type`。以下列出全部支援類型與參數。

---

## 欄位類型詳細說明

### 1. `text`

> `text` 僅呈現資訊但仍會在複製時輸出。

| 參數        | 型別    | 說明                                                                                           |
|-------------|---------|------------------------------------------------------------------------------------------------|
| `type`      | string  | 固定為 `"text"`                                                                                |
| `value`     | string  | 顯示在頁面上的文字，支援 `\n` 轉換為換行                                                         |
| `label`     | string  | 標籤文字。若提供，在複製時會自動組合為 `label + value`（除非另外提供 `prefix`）                    |
| `prefix`    | string  | 複製時加在內容前，會覆蓋 `label` 因此在複製時會組合為 `prefix + value`                            |
| `suffix`    | string  | 複製時加在內容後                                                                                |

### 2. `note`

> `note` 內容不會被複製，用於提醒、附註等非複製資訊。

| 參數        | 型別   | 說明                                                                                     |
|-------------|--------|------------------------------------------------------------------------------------------|
| `type`      | string | 固定為 `"note"`                                                                          |
| `value`     | string | 顯示文字，支援 `\n` 換行                      |
| `emphasis`  | bool   | `true` 時會套用醒目樣式（加深底色、文字色）                                              |


### 3. `input`

> `input` 用於單行輸入。

| 參數           | 型別   | 說明                                                                                                            |
|----------------|--------|-----------------------------------------------------------------------------------------------------------------|
| `type`         | string | `"input"`                                                                                                       |
| `id`           | string | DOM 元素 id，可用於自定樣式或辨識                                                                              |
| `label`        | string | 標籤文字。若提供，在複製時會自動組合為 `label + value`（除非另外提供 `prefix`）                              |
| `placeholder`  | string | 預設提示文字                                                                                                    |
| `value`        | string | 預設填入值                                                                                                      |
| `prefix`       | string | 複製時放在輸入內容前（會覆蓋 `label`）                                            |
| `suffix`       | string | 複製時放在輸入內容後                                                                                            |
| `indent`       | number | 複製時對輸出每一行加上固定空格數（例如 `2` 會在每行前加 2 個空格）                                             |

### 4. `textarea`

> `textarea` 用於輸入多行內容。

| 參數          | 型別   | 說明                                                                                                  |
|---------------|--------|-------------------------------------------------------------------------------------------------------|
| `type`        | string | `"textarea"`                                                                                          |
| `id`          | string | DOM id                                                                                                |
| `label`       | string | 標籤文字。若提供，在複製時會自動組合為 `label + value`（除非另外提供 `prefix`）                           |
| `placeholder` | string | 提示文字                                                                                              |
| `value`       | string | 預設內容（支援 `\n`）                                                                                 |
| `rows`        | number | 初始高度（行數），預設 `3`                                                                            |
| `prefix`      | string | 複製時放在內容前（會覆蓋 `label`）                                                                      |
| `suffix`      | string | 複製時放在內容後                                                                                      |
| `indent`      | number | 複製時對每一行加上固定空格數                                                                          |

### 5. `checkbox-group`

> `checkbox-group` 是多選項目

| 參數          | 型別   | 說明                                                                                                                      |
|---------------|--------|---------------------------------------------------------------------------------------------------------------------------|
| `type`        | string | `"checkbox-group"`                                                                                                        |
| `id` / `label`| string | 欄位識別與標題                                                                                                            |
| `prefix`      | string | 複製時插在整段的最前面（若未提供但 `label` 有值，預設為 `label + value`）                                                   |
| `suffix`      | string | 複製時加在整段後方                                                                                                        |
| `separator`   | string | 勾選項目連接字串                                                                                               |
| `options`     | array  | 勾選項目，每筆資料結構見下方                                                                                              |

#### `options` 內欄位
| 參數              | 型別   | 說明                                                                                                                    |
|-------------------|--------|-------------------------------------------------------------------------------------------------------------------------|
| `label`           | string | 顯示文字（如未提供 `value`，也會用來當複製文字）                                                                       |
| `value`           | string | 勾選後複製使用的字串                                                                                                    |
| `checked`         | bool   |  true 時預設勾選                                                                                                        |
| `fullRow`         | bool   |  true 時此項目佔整行，用於長文字                                                                                       |
| `withInput`       | bool   |  true 時會顯示補充欄位（如下表）                                                                                          |
| `detailType`      | string |  `"input"`（預設）或 `"textarea"`                                                                                       |
| `detailPlaceholder`| string| 補充欄位提示文字                                                                                                        |
| `detailValue`     | string | 補充欄位預設值                                                                                                          |
| `detailPrefix`    | string | 補充內容前綴（複製時與主文字相連）                                                                                       |
| `detailSuffix`    | string | 補充內容後綴                                                                                                            |
| `detailIndent`    | number | 補充內容每行縮排空格                                                                                                    |
| `detailRequired`  | bool   | 提醒欄位為必填（僅提示用途，無程式驗證）                                                                               |

> 複製時僅會帶入 **已勾選** 的選項。若選項內有補充欄位，且使用者有輸入文字，就會在選項文字後套上 `prefix + 補充內容 + suffix`；欄位未顯示或空白時不會輸出。

### 6. `radio-group`

欄位參數同 `checkbox-group`，但選項改為互斥單選；複製時只會輸出選中的一個。如果該選項有補充欄位，也會依照設定附加在該行後方。

---

## `indent`、換行與複製行為

* 所有輸入內容會先經 `normalizeLineBreaks` 將 `\n` 轉為真正換行。
* `textarea` 以及任何額外補充欄位可透過 `indent` 指定縮排（預設為 0）。
* `note` 不參與複製；`text`、`input`、`textarea`、勾選的項目都會包含在複製文字內。

---

## 客製化情境

| 需求                           | 修改方式                                                                                                                |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| 新增範本                       | 建立 `templates/xxx.json`，並於 `templates.json` 放入 `{ "name": "...", "file": "xxx.json" }`                          |
| 預設某欄位已填寫/勾選          | 在欄位物件設定 `value` 或 `checked: true`                                                                               |
| 增加更多欄位型別               | 在 `index.html` 中新增 template，並於 `script.js` 的 `fieldTemplates` 與 `renderField` 擴增案例                         |

---

## 限制

* 本工具為純靜態檔案，無伺服器端儲存功能；輸入資料僅暫存於瀏覽器記憶體。
