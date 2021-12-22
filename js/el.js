const el = tagName => (...children) => {
    let node = document.createElement(tagName)
    node.att$ = function(name,value) {
	if (value === void 0 ||
	    typeof(value) == 'boolean') {
	    this.toggleAttribute(name, value)
	} else {
            this.setAttribute(name,value)
	}
        return this
    }
    node.ch$ = function(...children) {
        for (let ch of children){
	    if (!ch) continue
            if (typeof(ch) === 'string') {
                ch = document.createTextNode(ch)
            }
            this.appendChild(ch)
        }
        return this
    }
    node.on$ = function(event, handler) {
        this.addEventListener(event, handler)
        return this
    }
    node.data$ = function(name, value) {
        this.dataset[name] = value
        return this
    }
    node.css$ = function(prop, value) {
        this.style[prop] = value
        return this
    }
    node.click$ = function(handler) {
        this.addEventListener('click', handler)
	this.att$('clickable', true)
        return this
    }
    node.map$ = function(handler) {
        handler(this)
        return this
    }
    node.wrap$ = function(el) {
        this.ch$ = this.ch$.bind(el)
        return this
    }
    node.return$ = x => x
    node.ch$(...children)
    return node
}

const fmap = a => f => (...args) => f(a(...args))

const HTML_TAGS = 'main section div span table tr td th spacer a button img ul ol li h1 h2 h3 h4 h5 h6 p form input label textarea i rule controls'

$ = []
HTML_TAGS.split(' ').forEach(tag => $[tag] = el(tag))

$.nohref = 'javascript:void(0)'



$.radio     = fmap($.input)(e=>e.att$('type','radio'))
$.checkbox  = fmap($.input)(e=>e.att$('type','checkbox'))
$.overlay   = fmap(el('overlay'))(e=>
    e.map$(o=>o.toggle$ = function(force){
	o.att$('hidden', force)
	o.dispatchEvent(
	    new CustomEvent(
		'toggle',
		{
		    detail: { open: !o.hasAttribute('hidden') },
		    bubbles: false,
		    cancellable: false,
		    composed: false,
		})
	)
    })
	.att$('hidden', true)
	.click$(ev=>{
	    if (ev.target == e) {
		e.toggle$()
	    }
	})
)

$.SPACER = -1;
$.DONE = 0;
$.CANCEL = 1;
$.DELETE = 2;

$.dialog = (controls, ...children) => {
    let overlay = $.overlay()
    overlay.clear$ = function() {
	for (let ch of children) {
	    if (ch instanceof HTMLInputElement) {
		ch.value = ""
	    }
	}
    }
    let cs = controls.map(c => {
	switch (c) {
	case $.SPACER:
	    return $.spacer()
	case $.CANCEL:
	    return $.button("Cancel")
		.att$('type', 'button') // to prevent submitting
		.click$(_e=>{
		    overlay.toggle$(true)
		    overlay.clear$()
		})
	case $.DONE:
	    return $.input()
		.att$('value', "Done")
		.att$('type', 'submit')
	case $.DELETE:
	    return $.button("Delete")
		.att$('type', 'button')
		.map$(e=>e.classList.add('delete'))
		.click$(_e=>{
		    overlay.dispatchEvent(
			new CustomEvent('delete',
					{
					    details: {},
					    bubbles: false,
					    cancellable: false,
					    composed: false,
					}))
		    overlay.toggle$(true)
		    overlay.clear$()
		})
	default:
	    console.log(`Unknown control type ${c}`)
	    return undefined
	}
    })
    overlay.ch$(
	$.form(
	    ...children,
	    $.controls(...cs),
	).on$('submit', e=> {
	    e.preventDefault()
	    overlay.dispatchEvent(
		new CustomEvent('done',
				{
				    details: {},
				    bubbles: false,
				    cancellable: false,
				    composed: false,
				}))
	    overlay.toggle$(true)
	}))
	.on$('toggle', e=>{
	    if (e.detail.open) {
		for (let ch of children) {
		    if (ch instanceof HTMLInputElement) {
			ch.focus()
			break
		    }
		}
	    }
	})
    return overlay
}

$.searchbox = url => fmap($.input)(e=>
    e.att$('type', 'search')
	.on$('keyup', ev => ev.keyCode===13 && (window.location.href = url+e.value))
)
$.editor    = fmap($.textarea)(e=>e.on$('keydown', function(e) {
    if (e.key == 'Tab') {
	e.preventDefault();
	const start = this.selectionStart;
	const end = this.selectionEnd;
	this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
	this.selectionStart = this.selectionEnd = start + 2;
    }
}))
$.tabs = (ts, default_tab = 0) => {
    let btns = el('tablist')()
    let tabs = Object.getOwnPropertyNames(ts)
    let ret = el('tabs')(btns, ts[tabs[default_tab]]())

    ret.current = default_tab
    ret.tabs = ts
    ret.update$ = () => btns.children[ret.current].click()
    ret.switchTo$ = num => btns.children[num].click()
    for (let [i, t] of tabs.entries()) {
        btns.ch$(
            $.button(t)
                .map$(el=>el.tab = ret.tabs[t])
                .click$(e => {
                    let el = e.currentTarget
                    if (el.tab != ret.lastElementChild) {
                        btns.children[ret.current].att$("current-tab")
                        ret.current = i
                        btns.children[ret.current].att$("current-tab")
                        ret.replaceChild(el.tab(), ret.lastElementChild)
                    }
                })
        )
    }
    btns.children[default_tab].att$("current-tab")
    return ret
}
