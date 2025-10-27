const divisionSelect = document.querySelector('#division-select');
const templateSelect = document.querySelector('#template-select');
const sectionsContainer = document.querySelector('#sections');
const sectionTemplate = document.querySelector('#section-template');
const copyAllButtons = Array.from(document.querySelectorAll('.js-copy-all'));
const fieldTemplates = {
  text: document.querySelector('#field-text-template'),
  input: document.querySelector('#field-input-template'),
  textarea: document.querySelector('#field-textarea-template'),
  'checkbox-group': document.querySelector('#field-checkbox-template'),
  'radio-group': document.querySelector('#field-radio-template'),
  note: document.querySelector('#field-note-template'),
};

let divisions = [];
let currentDivision = null;
let currentTemplate = null;
let toastTimer = null;

const TOAST_ID = 'copy-toast';
const measureCanvas = document.createElement('canvas');
const measureContext = measureCanvas.getContext('2d');
let resizeFrame = null;

function setCopyAllDisabled(disabled) {
  copyAllButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

async function init() {
  try {
    await loadDivisions();
  } catch (error) {
    console.error('無法讀取科別列表', error);
    showError('無法讀取科別列表，請確認 divisions.json 是否存在。');
    templateSelect.disabled = true;
    setCopyAllDisabled(true);
  }
}

async function loadDivisions() {
  const index = await fetchJson('divisions.json');
  divisions = index.divisions ?? [];
  populateDivisionSelect(divisions);

  if (divisions.length > 0) {
    const defaultDivision = divisions.find((dept) => dept.folder);
    if (defaultDivision?.folder) {
      divisionSelect.value = defaultDivision.folder;
      await handleDivisionChange(defaultDivision);
      return;
    }
  }

  templateSelect.disabled = true;
  templateSelect.innerHTML =
    '<option value="" disabled selected>請選擇科別</option>';
  setCopyAllDisabled(true);
}

function populateDivisionSelect(list) {
  divisionSelect.innerHTML =
    '<option value="" disabled selected>請選擇科別</option>';
  list.forEach((dept) => {
    if (!dept.folder) return;
    const option = document.createElement('option');
    option.value = dept.folder;
    option.textContent = dept.name ?? dept.folder;
    divisionSelect.append(option);
  });
}

function populateTemplateSelect(templates) {
  templateSelect.innerHTML =
    '<option value="" disabled selected>請選擇範本</option>';
  templates.forEach((tpl) => {
    const option = document.createElement('option');
    option.value = tpl.file ?? '';
    option.textContent = tpl.name;
    if (!tpl.file) {
      option.disabled = true;
    }
    templateSelect.append(option);
  });
}

async function handleDivisionChange(division) {
  currentDivision = null;
  currentTemplate = null;
  templateSelect.disabled = true;
  setCopyAllDisabled(true);
  sectionsContainer.innerHTML =
    '<p class="placeholder">請先選擇範本。</p>';
  templateSelect.innerHTML =
    '<option value="" disabled selected>載入範本中…</option>';

  if (!division?.folder) {
    templateSelect.innerHTML =
      '<option value="" disabled selected>請選擇範本</option>';
    return;
  }

  try {
    const index = await fetchJson(
      `templates/${division.folder}/templates.json`
    );
    const templates = index.templates ?? [];
    currentDivision = division;
    populateTemplateSelect(templates);
    templateSelect.disabled = templates.length === 0;

    const defaultTemplate = templates[0];
    if (defaultTemplate?.file) {
      templateSelect.value = defaultTemplate.file;
      await loadTemplate(defaultTemplate.file);
    } else {
      setCopyAllDisabled(true);
    }
  } catch (error) {
    console.error('無法讀取範本列表', error);
    showError('無法讀取範本列表，請確認資料夾是否存在 templates.json。');
    templateSelect.innerHTML =
      '<option value="" disabled selected>範本載入失敗</option>';
    templateSelect.disabled = true;
    setCopyAllDisabled(true);
  }
}

async function loadTemplate(file) {
  if (!file) return;

  try {
    const folder = currentDivision?.folder;
    const path = folder ? `templates/${folder}/${file}` : `templates/${file}`;
    const template = await fetchJson(path);
    currentTemplate = template;
    renderSections(template.sections ?? {});
  } catch (error) {
    console.error('無法讀取範本內容', error);
    showError('無法讀取選擇的範本內容。');
    setCopyAllDisabled(true);
  }
}

templateSelect.addEventListener('change', async (event) => {
  const file = event.target.value;
  if (!file) return;

  await loadTemplate(file);
});

copyAllButtons.forEach((button) => button.addEventListener('click', copyAllSections));

setCopyAllDisabled(true);
divisionSelect.addEventListener('change', async (event) => {
  const folder = event.target.value;
  if (!folder) return;
  const division = divisions.find((dept) => dept.folder === folder) ?? {
    folder,
    name: folder,
  };
  await handleDivisionChange(division);
});

function renderSections(sections) {
  sectionsContainer.innerHTML = '';
  const sectionOrder = ['Intro', 'S', 'O', 'A+P'];

  sectionOrder.forEach((key) => {
    if (!sections[key]) return;
      const sectionDef = sections[key];
      const sectionElement = sectionTemplate.content.firstElementChild.cloneNode(true);
      sectionElement.querySelector('h2').textContent = key;
      const body = sectionElement.querySelector('.section__body');

    sectionDef.forEach((field, index) => {
      const rendered = renderField(key, index, field);
      if (rendered) {
        body.append(rendered);
      }
    });

    sectionElement
      .querySelector('.copy-button')
      .addEventListener('click', () => copySection(key));

    sectionsContainer.append(sectionElement);
  });

  if (sectionsContainer.children.length === 0) {
    sectionsContainer.innerHTML = '<p class="placeholder">選擇的範本沒有定義任何區塊。</p>';
  }

  const hasRenderedSections = sectionsContainer.querySelectorAll('.section').length > 0;
  setCopyAllDisabled(!hasRenderedSections);

  autoResizeFields(sectionsContainer);
}

function renderField(sectionKey, index, field) {
  const template = fieldTemplates[field.type];
  if (!template) {
    console.warn(`未知的欄位型別：${field.type}`);
    return null;
  }

  const element = template.content.firstElementChild.cloneNode(true);
  const baseId = `${sectionKey}-${field.id ?? `${field.type}-${index}`}`;

  switch (field.type) {
    case 'text': {
      element.textContent = field.value ?? '';
      break;
    }
    case 'note': {
      const note = element.querySelector('.field__note');
      const content = field.value ?? '';
      note.innerHTML = content;
      if (field.emphasis) {
        element.classList.add('field--note-emphasis');
      }
      break;
    }
    case 'input': {
      const input = element.querySelector('input');
      input.id = baseId;
      input.placeholder = field.placeholder ?? '';
      if (field.value !== undefined) {
        input.value = field.value;
      }
      setupAutoResizeInput(input);
      element.querySelector('.field__label').textContent = field.label ?? '';
      break;
    }
    case 'textarea': {
      const textarea = element.querySelector('textarea');
      textarea.id = baseId;
      textarea.placeholder = field.placeholder ?? '';
      textarea.rows = field.rows ?? 3;
      if (field.value !== undefined) {
        textarea.value = field.value;
      }
      if (field.indent !== undefined) {
        textarea.dataset.indent = String(field.indent);
      }
      setupAutoResizeTextarea(textarea);
      element.querySelector('.field__label').textContent = field.label ?? '';
      break;
    }
    case 'checkbox-group': {
      element.querySelector('.field__label').textContent = field.label ?? '';
      const optionsContainer = element.querySelector('.field__options');
      (field.options ?? []).forEach((option, optionIndex) => {
        const optionId = `${baseId}-${optionIndex}`;
        const label = document.createElement('label');
        label.classList.add('field__option');
        if (option.fullRow) {
          label.classList.add('field__option--full');
        }
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = optionId;
        input.value = option.value ?? option.label ?? '';
        input.name = baseId;
        input.checked = Boolean(option.checked);
        const span = document.createElement('span');
        span.textContent = option.label ?? option.value ?? '';
        const main = document.createElement('span');
        main.classList.add('field__option-main');
        main.append(input, span);
        label.append(main);

        if (option.withInput) {
          const detailType = option.detailType === 'textarea' ? 'textarea' : 'input';
          if (detailType === 'textarea') {
            label.classList.add('field__option--has-detail');
          }
          const detail = document.createElement(detailType);
          if (detailType === 'input') {
            detail.type = option.detailInputType ?? 'text';
          } else if (option.detailRows) {
            detail.rows = option.detailRows;
          }
          detail.classList.add('field__option-detail');
          detail.dataset.detailFor = optionId;
          detail.placeholder = option.detailPlaceholder ?? '';
          if (option.detailValue !== undefined) {
            detail.value = option.detailValue;
          }
          if (option.detailPrefix !== undefined) {
            detail.dataset.detailPrefix = option.detailPrefix;
          }
          if (option.detailSuffix !== undefined) {
            detail.dataset.detailSuffix = option.detailSuffix;
          }
          if (option.detailRequired) {
            detail.dataset.detailRequired = 'true';
          }
          const detailIndent = option.detailIndent ?? option.indent;
          if (detailIndent !== undefined) {
            detail.dataset.indent = String(detailIndent);
          }
          if (detailType === 'textarea') {
            setupAutoResizeTextarea(detail);
          } else {
            setupAutoResizeInput(detail);
          }
          detail.disabled = !input.checked;
          if (!input.checked) {
            detail.setAttribute('hidden', '');
          } else {
            detail.removeAttribute('hidden');
            triggerAutoResize(detail);
          }
          input.addEventListener('change', () => {
            const isChecked = input.checked;
            detail.disabled = !isChecked;
            if (isChecked) {
              detail.removeAttribute('hidden');
              triggerAutoResize(detail);
            } else {
              detail.setAttribute('hidden', '');
            }
          });
          label.append(detail);
        }

        optionsContainer.append(label);
      });
      break;
    }
    case 'radio-group': {
      element.querySelector('.field__label').textContent = field.label ?? '';
      const optionsContainer = element.querySelector('.field__options');
      (field.options ?? []).forEach((option, optionIndex) => {
        const optionId = `${baseId}-${optionIndex}`;
        const label = document.createElement('label');
        label.classList.add('field__option');
        if (option.fullRow) {
          label.classList.add('field__option--full');
        }

        const input = document.createElement('input');
        input.type = 'radio';
        input.id = optionId;
        input.name = baseId;
        input.value = option.value ?? option.label ?? '';
        input.checked = Boolean(option.checked);

        const span = document.createElement('span');
        span.textContent = option.label ?? option.value ?? '';
        const main = document.createElement('span');
        main.classList.add('field__option-main');
        main.append(input, span);
        label.append(main);

        if (option.withInput) {
          const detailType = option.detailType === 'textarea' ? 'textarea' : 'input';
          if (detailType === 'textarea') {
            label.classList.add('field__option--has-detail');
          }
          const detail = document.createElement(detailType);
          if (detailType === 'input') {
            detail.type = option.detailInputType ?? 'text';
          } else if (option.detailRows) {
            detail.rows = option.detailRows;
          }
          detail.classList.add('field__option-detail');
          detail.dataset.detailFor = optionId;
          detail.placeholder = option.detailPlaceholder ?? '';
          if (option.detailValue !== undefined) {
            detail.value = option.detailValue;
          }
          if (option.detailPrefix !== undefined) {
            detail.dataset.detailPrefix = option.detailPrefix;
          }
          if (option.detailSuffix !== undefined) {
            detail.dataset.detailSuffix = option.detailSuffix;
          }
          if (option.detailRequired) {
            detail.dataset.detailRequired = 'true';
          }
          const detailIndent = option.detailIndent ?? option.indent;
          if (detailIndent !== undefined) {
            detail.dataset.indent = String(detailIndent);
          }
          if (detailType === 'textarea') {
            setupAutoResizeTextarea(detail);
          } else {
            setupAutoResizeInput(detail);
          }
          detail.disabled = !input.checked;
          if (!input.checked) {
            detail.setAttribute('hidden', '');
          } else {
            detail.removeAttribute('hidden');
            triggerAutoResize(detail);
          }
          label.append(detail);
        }

        optionsContainer.append(label);
      });

      const updateDetails = () => {
        const detailInputs = optionsContainer.querySelectorAll('[data-detail-for]');
        detailInputs.forEach((detail) => {
          const radio = document.getElementById(detail.dataset.detailFor);
          const isActive = radio?.checked ?? false;
          detail.disabled = !isActive;
          if (isActive) {
            detail.removeAttribute('hidden');
            triggerAutoResize(detail);
          } else {
            detail.setAttribute('hidden', '');
          }
        });
      };

      optionsContainer.addEventListener('change', (event) => {
        if (event.target.matches('input[type="radio"]')) {
          updateDetails();
        }
      });

      updateDetails();
      window.setTimeout(updateDetails, 0);
      break;
    }
    default:
      return null;
  }

  element.dataset.section = sectionKey;
  element.dataset.fieldId = baseId;
  element.dataset.fieldType = field.type;
  if (field.label) {
    element.dataset.fieldLabel = field.label;
  }
  if (Object.prototype.hasOwnProperty.call(field, 'prefix')) {
    element.dataset.fieldPrefix = field.prefix ?? '';
  }
  if (Object.prototype.hasOwnProperty.call(field, 'suffix')) {
    element.dataset.fieldSuffix = field.suffix ?? '';
  }
  if (Object.prototype.hasOwnProperty.call(field, 'separator')) {
    element.dataset.fieldSeparator = field.separator ?? '';
  }
  if (Object.prototype.hasOwnProperty.call(field, 'joiner')) {
    element.dataset.fieldJoiner = field.joiner ?? '';
  }

  return element;
}

async function copySection(sectionKey) {
  if (!currentTemplate) return;

  // Intro 跟 S 要一起複製
  if (['Intro', 'S'].includes(sectionKey)) {
    const sectionOrder = ['Intro', 'S'];
    const blocks = [];
    sectionOrder.forEach((key) => {
      const content = buildSectionText(key);
      blocks.push(`${content}`);
    });

    if (blocks.length === 0) {
      showError('目前沒有可以複製的內容。');
      return;
    }

    const fullText = blocks.join('\n\n');
    const copied = await copyToClipboard(fullText);
    if (copied) {
      showToast(`已複製 Intro + S 區塊。`);
      return;
    }
  }

  const text = buildSectionText(sectionKey);
  if (!text.trim()) {
    showError('尚未填寫任何內容，無法複製。');
    return;
  }

  const copied = await copyToClipboard(text);
  if (copied) {
    showToast(`已複製 ${sectionKey} 區塊。`);
    return;
  }

  showError('瀏覽器無法自動複製，請手動選取並複製內容。');
}

function buildSectionText(sectionKey) {
  const fields = sectionsContainer.querySelectorAll(
    `[data-section="${sectionKey}"]`
  );

  const lines = [];
  fields.forEach((field) => {
    const type = field.dataset.fieldType;
    const label = field.dataset.fieldLabel ?? '';
    const rawPrefix = field.dataset.fieldPrefix;
    const rawSuffix = field.dataset.fieldSuffix;
    const prefix =
      rawPrefix !== undefined ? rawPrefix : label ? `${label}：` : '';
    const suffix = rawSuffix !== undefined ? rawSuffix : '';
    const joiner = field.dataset.fieldJoiner ?? null;

    switch (type) {
      case 'text': {
        const value = field.textContent;
        if (value) {
          if (joiner !== null && lines.length > 0) {
            lines[lines.length - 1] += joiner + value;
          } else {
            lines.push(value);
          }
        }
        break;
      }
      case 'note': {
        break;
      }
      case 'input': {
        const input = field.querySelector('input');
        const value = input.value;
        if (value) {
          if (joiner !== null && lines.length > 0) {
            lines[lines.length - 1] += joiner + `${prefix}${value}${suffix}`;
          } else {
            lines.push(`${prefix}${value}${suffix}`);
          }
        }
        break;
      }
      case 'textarea': {
        const textarea = field.querySelector('textarea');
        const rawValue = textarea.value;
        const indent = parseIndent(textarea.dataset.indent);
        const value = applyIndent(rawValue, indent);
        if (value) {
          if (joiner !== null && lines.length > 0) {
            lines[lines.length - 1] += joiner + `${prefix}${value}${suffix}`;
          } else {
            lines.push(`${prefix}${value}${suffix}`);
          }
        }
        break;
      }
      case 'checkbox-group': {
        const checked = [...field.querySelectorAll('input[type="checkbox"]:checked')];
        if (checked.length > 0) {
          const values = checked
            .map((item) => {
              const optionValue = item.value;
              const detail = field.querySelector(`[data-detail-for=\"${item.id}\"]`);
              if (detail && !detail.hidden) {
                const rawDetailPrefix = detail.dataset.detailPrefix;
                const rawDetailSuffix = detail.dataset.detailSuffix;
                const detailPrefix =
                  rawDetailPrefix !== undefined ? rawDetailPrefix : '';
                const detailSuffix =
                  rawDetailSuffix !== undefined ? rawDetailSuffix : '';
                const detailIndent = parseIndent(detail.dataset.indent);
                const detailValue = applyIndent(
                  detail.value,
                  detailIndent
                );
                if (detailValue) {
                  return `${optionValue}${detailPrefix}${detailValue}${detailSuffix}`;
                }
                if (detailPrefix !== '' || detailSuffix !== '') {
                  return `${optionValue}${detailPrefix}${detailSuffix}`;
                }
              }
              return optionValue;
            })
            .filter(Boolean);
          if (values.length > 0) {
            const rawSeparator = field.dataset.fieldSeparator;
            const separator =
              rawSeparator !== undefined ? rawSeparator : ', ';
            const joined = values.join(separator);
            if (joiner !== null && lines.length > 0) {
              lines[lines.length - 1] += joiner + `${prefix}${joined}${suffix}`;
            } else {
              lines.push(`${prefix}${joined}${suffix}`);
            }
          }
        }
        break;
      }
      case 'radio-group': {
        const selected = field.querySelector('input[type="radio"]:checked');
        if (selected) {
          let line = `${prefix}${selected.value}${suffix}`;
          const detail = field.querySelector(`[data-detail-for="${selected.id}"]`);
          if (detail) {
            const rawDetailPrefix = detail.dataset.detailPrefix;
            const rawDetailSuffix = detail.dataset.detailSuffix;
            const detailPrefix =
              rawDetailPrefix !== undefined ? rawDetailPrefix : '';
            const detailSuffix =
              rawDetailSuffix !== undefined ? rawDetailSuffix : '';
            const detailIndent = parseIndent(detail.dataset.indent);
            const detailValue = applyIndent(
              detail.value,
              detailIndent
            );
            if (detailValue) {
              line += `${detailPrefix}${detailValue}${detailSuffix}`;
            } else if (detailPrefix !== '' || detailSuffix !== '') {
              line += `${detailPrefix}${detailSuffix}`;
            }
          }
          if (line.length === 0) {
            break;
          } else if (joiner !== null && lines.length > 0) {
            lines[lines.length - 1] += joiner + line;
          } else {
            lines.push(line);
          }
        }
        break;
      }
      default:
        break;
    }
  });

  return lines.join('\n');
}

async function copyAllSections() {
  if (!currentTemplate) {
    showError('尚未選擇範本，請先選擇範本後再複製。');
    return;
  }

  const sectionOrder = ['Intro', 'A+P', 'S', 'O'];
  const blocks = [];

  sectionOrder.forEach((key) => {
    if (!currentTemplate.sections || !currentTemplate.sections[key]) return;
    const content = buildSectionText(key);
    if (content.trim()) {
      blocks.push(`${content}`);
    }
  });

  if (blocks.length === 0) {
    showError('目前沒有可以複製的內容。');
    return;
  }

  const fullText = blocks.join('\n\n');
  const copied = await copyToClipboard(fullText);
  if (copied) {
    showToast('已複製全部區塊。');
    return;
  }

  showError('瀏覽器無法自動複製，請手動選取並複製內容。');
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }
  return response.json();
}

function showToast(message) {
  let toast = document.querySelector(`#${TOAST_ID}`);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.className = 'toast';
    document.body.append(toast);
  }

  toast.textContent = message;
  toast.classList.add('is-visible');

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2000);
}

function showError(message) {
  window.alert(message);
}

function parseIndent(value) {
  if (value === undefined) return 0;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function applyIndent(text, indent) {
  if (typeof text !== 'string' || !text) return text;
  if (!indent) return text;
  const pad = ' '.repeat(indent);
  return text
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');
}

function resolveCssSize(element, value) {
  if (!value || value === 'auto' || value === 'initial') return null;
  if (value === 'none') return Infinity;
  if (value.endsWith('px')) {
    const num = Number.parseFloat(value);
    return Number.isNaN(num) ? null : num;
  }
  if (value.endsWith('%')) {
    const num = Number.parseFloat(value);
    if (Number.isNaN(num)) return null;
    const parent = element.parentElement;
    const parentWidth =
      parent && parent.clientWidth ? parent.clientWidth : element.ownerDocument.documentElement.clientWidth;
    return (parentWidth * num) / 100;
  }
  const num = Number.parseFloat(value);
  return Number.isNaN(num) ? null : num;
}

function setupAutoResizeInput(input) {
  if (!input || input.dataset.autoResizeBound === 'true') return;

  const resizeNow = () => {
    const style = window.getComputedStyle(input);
    const minWidth = resolveCssSize(input, style.minWidth) ?? 0;
    const resolvedMaxWidth = resolveCssSize(input, style.maxWidth);
    const maxWidth = resolvedMaxWidth ?? Infinity;
    const padding =
      (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const border =
      (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
    const text = input.value || input.placeholder || ' ';

    let contentWidth;
    if (measureContext) {
      if (style.font) {
        measureContext.font = style.font;
      } else {
        const fontParts = [
          style.fontStyle,
          style.fontVariant,
          style.fontWeight,
          style.fontSize,
          style.fontFamily,
        ].filter(Boolean);
        measureContext.font = fontParts.join(' ');
      }
      contentWidth = measureContext.measureText(text).width;
    } else {
      input.style.width = 'auto';
      contentWidth = input.scrollWidth;
    }

    const desired = contentWidth + padding + border + 2;
    const width = Math.min(maxWidth, Math.max(minWidth, desired));
    input.style.width = `${width}px`;
  };

  const resize = () => window.requestAnimationFrame(resizeNow);
  input.addEventListener('input', resize);
  input.addEventListener('change', resize);
  input.dataset.autoResizeBound = 'true';
  input._autoResize = resize;
  resize();
}

function setupAutoResizeTextarea(textarea) {
  if (!textarea || textarea.dataset.autoResizeBound === 'true') return;

  const resizeNow = () => {
    const style = window.getComputedStyle(textarea);
    const minHeight = parseFloat(style.minHeight) || 0;
    const maxHeightRaw =
      style.maxHeight === 'none' ? Infinity : parseFloat(style.maxHeight);
    const maxHeight = Number.isFinite(maxHeightRaw) ? maxHeightRaw : Infinity;
    const border =
      (parseFloat(style.borderTopWidth) || 0) +
      (parseFloat(style.borderBottomWidth) || 0);
    const padding =
      (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);

    textarea.style.height = 'auto';
    let newHeight = textarea.scrollHeight + border + padding;
    newHeight = Math.max(minHeight, newHeight);
    if (Number.isFinite(maxHeight)) {
      newHeight = Math.min(newHeight, maxHeight);
    }
    textarea.style.height = `${newHeight}px`;
  };

  const resize = () => window.requestAnimationFrame(resizeNow);
  textarea.addEventListener('input', resize);
  textarea.addEventListener('change', resize);
  textarea.addEventListener('focus', resize);
  textarea.dataset.autoResizeBound = 'true';
  textarea._autoResize = resize;
  resize();
}

function triggerAutoResize(element) {
  if (!element) return;
  if (element.tagName) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'textarea') {
      setupAutoResizeTextarea(element);
    } else if (tag === 'input' && element.type !== 'checkbox' && element.type !== 'radio') {
      setupAutoResizeInput(element);
    }
  }
  if (typeof element._autoResize === 'function') {
    element._autoResize();
  }
}

function autoResizeFields(root) {
  const scope = root instanceof Element ? root : document;
  scope
    .querySelectorAll(
      'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="tel"], input[type="url"]'
    )
    .forEach((input) => setupAutoResizeInput(input));
  scope.querySelectorAll('textarea').forEach((textarea) => setupAutoResizeTextarea(textarea));
}

window.addEventListener('resize', () => {
  if (resizeFrame) return;
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;
    autoResizeFields(sectionsContainer);
  });
});

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Clipboard API 複製失敗', error);
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.append(textarea);
  textarea.select();

  try {
    const successful = document.execCommand('copy');
    if (!successful) {
      throw new Error('document.execCommand returned false');
    }
    return true;
  } catch (error) {
    console.error('execCommand 複製失敗', error);
    return false;
  } finally {
    textarea.remove();
  }
}

init();
