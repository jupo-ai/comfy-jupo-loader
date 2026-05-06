const CHAR_CODE_ZERO = "0".charCodeAt(0);
const CHAR_CODE_NINE = "9".charCodeAt(0);

// キャレット座標計算用のプロパティ一覧
const COPY_PROPERTIES = [
    "direction", "boxSizing", "width", "height", "overflowX", "overflowY", 
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", 
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", 
    "fontStyle", "fontVariant", "fontStretch", "fontSize", "fontSizeAdjust", 
    "lineHeight", "fontFamily", "textAlign", "textTransform", "textIndent", 
    "textDecoration", "letterSpacing", "wordSpacing", "tabSize", "MozTabSize"
];

const isBrowser = typeof window !== "undefined";
const isFirefox = isBrowser && window.mozInnerScreenX != null;


// ==============================================
// テキストエリアのキャレット管理クラス
// ==============================================

export class TextareaCaretManager {
    constructor(element, getScale) {
        this.element = element;
        this.getScale = getScale;

        if (!isBrowser) {
            throw new Error("ブラウザ環境でのみ使用可能です");
        }
    }

    // ------------------------------------------
    // ユーティリティ: キャレット座標計算
    // ------------------------------------------
    #getCaretCoordinates(position, options = {}) {
        const debug = options.debug || false;
        if (debug) {
            const element = document.querySelector("#input-textarea-caret-position-mirror-div");
            if (element) element.remove();
        }

        const div = document.createElement("div");
        div.id = "input-textarea-caret-position-mirror-div";
        document.body.appendChild(div);

        const style = div.style;
        const computed = window.getComputedStyle ? window.getComputedStyle(this.element) : this.element.currentStyle;
        const isInput = this.element.nodeName == "INPUT";

        style.whiteSpace = "pre-wrap";
        if (!isInput) style.overflowWrap = "break-word";

        style.position = "absolute";
        if (!debug) style.visibility = "hidden";

        COPY_PROPERTIES.forEach(prop => {
            if (isInput && prop === "lineHeight") {
                if (computed.boxSizing === "border-box") {
                    const height = parseInt(computed.height);
                    const outerHeight = 
                        parseInt(computed.paddingTop) + 
                        parseInt(computed.paddingBottom) + 
                        parseInt(computed.borderTopWidth) + 
                        parseInt(computed.borderBottomWidth);
                    const targetHeight = outerHeight + parseInt(computed.lineHeight);
                    if (height > targetHeight) {
                        style.lineHeight = height - outerHeight + "px";
                    } else if (height === targetHeight) {
                        style.lineHeight = computed.lineHeight;
                    } else {
                        style.lineHeight = 0;
                    }
                } else {
                    style.lineHeight = computed.height;
                }
            } else {
                style[prop] = computed[prop];
            }
        });

        if (isFirefox) {
            if (this.element.scrollHeight > parseInt(computed.height)) {
                style.overflowY = "scroll";
            }
        } else {
            style.overflow = "hidden";
        }

        div.textContent = this.element.value.substring(0, position);
        if (isInput) {
            div.textContent = div.textContent.replace(/\s/g, "\u00a0");
        }

        const span = document.createElement("span");
        span.textContent = this.element.value.substring(position) || ".";
        div.appendChild(span);

        const coordinates = {
            top: span.offsetTop + parseInt(computed.borderTopWidth), 
            left: span.offsetLeft + parseInt(computed.borderLeftWidth), 
            height: parseInt(computed.lineHeight), 
        };

        if (debug) {
            span.style.backgroundColor = "#aaa";
        } else {
            div.remove();
        }

        return coordinates;
    }

    // ------------------------------------------
    // ユーティリティ: 要素座標計算
    // ------------------------------------------
    #calculateElementOffset() {
        const rect = this.element.getBoundingClientRect();
        const owner = this.element.ownerDocument;
        if (!owner) throw new Error("要素がドキュメントに属していません");

        const { defaultView, documentElement } = owner;
        if (!defaultView) throw new Error("要素がウィンドウに属していません");

        const offset = {
            top: rect.top + defaultView.pageYOffset, 
            left: rect.left + defaultView.pageXOffset, 
        };

        if (documentElement) {
            offset.top -= documentElement.clientTop;
            offset.left -= documentElement.clientLeft;
        }
        return offset;
    }

    #isDigit(charCode) {
        return CHAR_CODE_ZERO <= charCode && charCode <= CHAR_CODE_NINE;
    }

    #getLineHeightPx() {
        const computedStyle = getComputedStyle(this.element);
        const lineHeight = computedStyle.lineHeight;

        if (this.#isDigit(lineHeight.charCodeAt(0))) {
            const floatLineHeight = parseFloat(lineHeight);
            return this.#isDigit(lineHeight.charCodeAt(lineHeight.length - 1))
                ? floatLineHeight * parseFloat(computedStyle.fontSize)
                : floatLineHeight;
        }

        return this.#calculateLineHeightPx(this.element.nodeName, computedStyle);
    }

    #calculateLineHeightPx(nodeName, computedStyle) {
        const body = document.body;
        if (!body) return 0;

        const tempNode = document.createElement(nodeName);
        tempNode.innerHTML = " ";
        Object.assign(tempNode.style, {
            fontSize: computedStyle.fontSize, 
            fontFamily: computedStyle.fontFamily, 
            padding: "0", 
            position: "absolute", 
        });
        body.appendChild(tempNode);

        if (tempNode instanceof HTMLTextAreaElement) {
            tempNode.rows = 1;
        }

        const height = tempNode.offsetHeight;
        tempNode.remove();
        return height;
    }

    #getElementScroll() {
        return { top: this.element.scrollTop, left: this.element.scrollLeft };
    }

    #getCursorPosition() {
        return this.#getCaretCoordinates(this.element.selectionEnd);
    }

    
    // ------------------------------------------
    // パブリックメソッド
    // ------------------------------------------
    // --- カーソルオフセット取得 ---
    getCursorOffset() {
        const scale = this.getScale();
        const elementOffset = this.#calculateElementOffset();
        const elementScroll = this.#getElementScroll();
        const cursorPosition = this.#getCursorPosition();
        const lineHeight = this.#getLineHeightPx();
        
        const top = elementOffset.top - (elementScroll.top * scale) + (cursorPosition.top + lineHeight) * scale;
        const left = elementOffset.left - elementScroll.left + cursorPosition.left;
        const clientTop = this.element.getBoundingClientRect().top;

        const rect = this.element.getBoundingClientRect();

        if (this.element.dir !== "rtl") {
            return {top, left, lineHeight, clientTop, width: rect.width };
        } else {
            const right = document.documentElement?.clientWidth - left || 0;
            return { top, right, lineHeight, clientTop, width: rect.width };
        }
    }

    // --- カーソルの前の文字列を取得 ---
    getBeforeCursor() {
        return this.element.selectionStart !== this.element.selectionEnd
            ? null
            : this.element.value.substring(0, this.element.selectionEnd);
    }

    // --- カーソルの後の文字列を取得 ---
    getAfterCursor() {
        return this.element.value.substring(this.element.selectionEnd);
    }

    // --- カーソルの位置に文字列を挿入 ---
    insertAtCursor(value, offset = 0, finalOffset = 0) {
        if (this.element.selectionStart != null) {
            const startPos = this.element.selectionStart;
            const endPos = this.element.selectionEnd;

            this.element.selectionStart = startPos + offset;
            this.element.setRangeText(value, this.element.selectionStart, endPos, "end");
            this.element.selectionStart = this.element.selectionEnd = startPos + value.length + offset + finalOffset;
            
            this.element.dispatchEvent(new Event("input", { bubbles: true }));
        
        } else {
            console.warn("selectionStart が取得できませんでした");
            this.element.value += value;
        }
    }



}