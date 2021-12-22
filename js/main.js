const APP_NAME = "APP_NAME"

const DECKS_TAB = 0
const LEARN_TAB = 1

const DESIRED_RETENTION = 0.85

const MAX_DAILY_NEW_CARDS = 10
const MAX_DAILY_REVIEW_CARDS = 200

const Theme = {
    Dark: 'dark',
    Light: 'light',
}

let theme = Theme.Dark

let decks = []

let navigation;

let current_deck = {
    index: undefined,
    setTo: function(d) {
	this.index = d
    },
    getDeck: function() {
	return decks[this.index]
    },
    getCards: function() {
	return this.getDeck().cards
    },
    getIndex: function() {
	return this.index
    },
}

const empty_deck = name => ({
    name: name,
    cards: [],
})

const card_state = {
    NEW: 0,
    REVIEW: 1,
}

const card = (front, back) => ({
    front: front,
    back: back,
    state: card_state.NEW,
    delay: 1,
    due: new Date(),
    ease: 1,
    avg_ease: 1,
    times_reviewed: 0,
    times_correct: 0,
})

// TODOO: Make export_deck async, it can't pause the UI on big decks
function export_deck(deck_index) {
    const deck = decks[deck_index]
    deck.cards = deck.cards.map(c => ({front: c.front, back: c.back})) // We don't want to export the user's progress
    const json = JSON.stringify(deck)
    const filename = `${APP_NAME}-deck-${deck.name}.json`
    $.a()
        .att$('download', filename)
        .att$('href', `data:application/json;charset=utf-8,${encodeURIComponent(json)}`)
        .click()
}

function import_deck() {
    const input = $.input().att$('type', 'file').att$('accept', '.json')
    input.click()
    input.addEventListener('change', ()=> {
        input.files[0].text().then(str => {
	    try {
		let deck = JSON.parse(str)
		deck.cards = deck.cards.map(c => card(c.front, c.back))
		decks.push(deck)
		current_deck.setTo(decks.length-1)
		navigation.update$()
	    } catch (e) {
		console.error("[ERR] Importing deck: couldn't parse")
		console.error(e)	
	    }
	})
    })
}

function delete_deck(deck_index) {
    let dialog = $.dialog(
	[$.DELETE, $.CANCEL],
	$.span($.h3("Delete Deck")),
	`Do you really want to delete "${decks[deck_index].name}"?`
    ).on$('delete', _e=>{
	decks = [...decks.slice(0,deck_index), ...decks.slice(deck_index+1)]
	navigation.update$()
    })
    body.insertBefore(dialog, body.querySelector('main'));
    dialog.toggle$()
}

function edit_card(card_index) {
    let front = $.input()
	.att$('type', 'text')
    front.value = current_deck.getCards()[card_index].front
    let back = $.input()
	.att$('type', 'text')
    back.value = current_deck.getCards()[card_index].back
    let dialog = $.dialog(
	[$.DELETE, $.SPACER, $.DONE, $.CANCEL],
	$.span($.h3("Edit Card")),
	"Front:",
	front,
	"Back:",
	back,
    ).on$('done', _e=>{
	if (front.value != "" && back.value != "") {
	    current_deck.getCards()[card_index].front = front.value
	    current_deck.getCards()[card_index].back = back.value
	    current_deck.getCards()[card_index].due = new Date() // if a card is edited, the user should learn it immediately
	    navigation.update$()
	    body.removeChild(dialog)
	}
    }).on$('delete', _e=>{
	let cards = current_deck.getCards()
	current_deck.getDeck().cards =
	    [...cards.slice(0,card_index), ...cards.slice(card_index+1)]
	navigation.update$()
    })

    body.insertBefore(dialog, body.querySelector('main'));
    dialog.toggle$()
}

function print_due_date(c) {
    if (c.state == card_state.NEW) {
	return "New"
    }
    const due = c.due
    const year = due.getFullYear()
    const month = due.getMonth()
    const date = due.getDate()
    const today = new Date()
    if (today.getMonth() == month &&
	today.getDate() == date) {
	return "Today"
    }
    return due.toLocaleDateString()
}

function calc_retention(c) {
    if (c.state == card_state.NEW) {
	return 0
    }
    const correct = c.times_correct
    const total   = c.times_reviewed
    return correct / total
}

function print_card_retention(c) {
    const ret_percent = Math.round(calc_retention(c) * 100)
    return ret_percent + ' %'
}

function sort_cards(cs, f) {
    cs.sort((c1, c2) => f(c1) > f(c2))
    navigation.update$()
}

function render_cards(cs) {
    return [$.th("Front").click$(_e => sort_cards(cs, c=>c.front)),
	    $.th("Due").click$(_e => sort_cards(cs, c=>c.due)),
	    $.th("Retention").click$(_e => sort_cards(cs, calc_retention)),
	    $.th("Back"),
	    ...cs.flatMap((c, i) => {
		return [$.td(c.front).click$(()=>edit_card(i)),
			$.td(print_due_date(c)).click$(()=>edit_card(i)),
			$.td(print_card_retention(c)).click$(()=>edit_card(i)),
			$.td(c.back).click$(()=>edit_card(i))]
	    })]
}

function learn(deck_index) {
    let view = x => x && body.querySelector('tabs>div').replaceWith(x)
    const deck = decks[deck_index]
    const today = new Date()
    let pending_review = deck.cards.filter(c =>
	c.state == card_state.REVIEW
	    // && c.due.getYear() == today.getYear()
	    // && c.due.getMonth() == today.getMonth()
	    // && c.due.getDate() == today.getDate()
    )
    let pending_new = deck.cards.filter(c => c.state == card_state.NEW)
    console.log(pending_review)
    console.log(pending_new)
    let reviewed = 0
    let curr_rev = 0
    let curr_new = 0
    let new_card_interval = Math.min(
	Math.floor((pending_review.length + pending_new.length) / pending_new.length),
	Math.floor((MAX_DAILY_REVIEW_CARDS + MAX_DAILY_NEW_CARDS) / MAX_DAILY_NEW_CARDS)
    )
    function next_card() {
	if (reviewed >= pending_review.length + pending_new.length) return undefined
	if (reviewed % new_card_interval == 0) {
	    if (curr_new >= pending_new.length) {
		new_card_interval = 1000000
	    } else {
		let ret = pending_new[curr_new]
		curr_new++
		reviewed++
		return ret
	    }
	}
	let ret = pending_review[curr_rev]
	curr_rev++
	reviewed++
	return ret
    }

    /// Equation from [https://eshapard.github.io/anki/thoughts-on-a-new-algorithm-for-anki.html]
    function update_card(c) {
	// TODOO: Refactor NEW/REVIEW into data structures in the deck
	c.state = card_state.REVIEW
	let hist_succ_rate = 0.01
	if (c.times_correct > 0)
	    hist_succ_rate = c.times_correct / c.times_reviewed
	if (hist_succ_rate >= 1)
	    hist_succ_rate = 0.99
	let new_ease = c.avg_ease * Math.log(DESIRED_RETENTION) / Math.log(hist_succ_rate)
	const bounds= [c.ease * 0.8, c.ease * 1.2]
	if (new_ease < bounds[0])
	    new_ease = bounds[0]
	if (new_ease > bounds[1])
	    new_ease = bounds[1]
	c.ease = new_ease
	c.avg_ease = (c.avg_ease * c.times_reviewed + c.ease) / c.times_reviewed
	c.delay *= c.ease
	let next_review = c.due.getDate() + Math.round(c.delay)
	c.due.setDate(next_review)
    }
    let card_view = (card, front) => {
	if (!card) {
	    navigation.switchTo$(LEARN_TAB)
	    return undefined;
	}
	let next = front
	    ? [card, false]
	    : [next_card(), true];
	return $.div(
	    $.spacer(),
	    $.div(
		card.front,
		!front && $.rule(),
		!front && card.back,
	    ).map$(e=>e.classList.add('card')),
	    $.spacer(),
	    $.span(
		...front
		    ? [$.button("Flip")
		       .click$(_e => view(card_view(...next)))]
		    : [$.button("Again")
		       .click$(_e => {
			   card.times_reviewed++
			   update_card(card)
			   view(card_view(...next))
		       }),
		       $.button("Good")
		       .click$(_e => {
			   card.times_reviewed++
			   card.times_correct++
			   update_card(card)
			   view(card_view(...next))
		       })]
	    )
	).att$('id', 'learn')
    }
    view(card_view(next_card(), true))
}

function render() {
    const root = $.main()

    let deck_name = $.input()
	.att$('type', 'text')
	.att$('maxlength', 32)
    
    let add_deck_view = $.dialog(
	[$.DONE, $.CANCEL],
	$.span($.h3("Add Deck")),
	"Deck name:",
	deck_name
    ).on$('done', e => {
	if (deck_name.value != "") {
	    current_deck.setTo(decks.length)
	    decks.push(
		empty_deck(deck_name.value)
	    )
	    add_deck_view.clear$()
	    navigation.update$()
	}
    })
    body.appendChild(add_deck_view)

    const add_deck = () => {
	add_deck_view.toggle$()
    }

    let front = $.input()
	.att$('type', 'text')
    let back = $.input()
	.att$('type', 'text')
    let add_card_view = $.dialog(
	[$.DONE, $.CANCEL],
	$.span($.h3("Add Card")),
	"Front:",
	front,
	"Back:",
	back,
    ).on$('done', e=>{
	if (front.value != "" &&  back.value  != "") {
	    current_deck.getCards().push(
		card(front.value,
		     back.value)
	    )
	    add_card_view.clear$()
	    navigation.update$()
	}
    })
    body.appendChild(add_card_view)
    

    const add_card = () => add_card_view.toggle$()
    
    const decks_view = () =>
	  $.div(
	      $.section(
		  decks.length == 0 &&
		      $.span("You haven't created a deck yet"),
		  $.ul(
		      ...decks.map((deck, index) =>
			  $.li(deck.name)
			      .att$('current-deck', current_deck.getIndex() == index)
			      .click$(_e => {
				  current_deck.setTo(index)
				  navigation.update$()
			      }))
		  ),
		  $.spacer(),
		  $.span(
		      $.button("Add deck")
			  .click$(()=>add_deck()),
		      $.button("Import deck")
			  .click$(()=>import_deck()),
		  )
	      ).att$('id', 'decks'),
	      $.rule(),
	      $.section(
		  decks.length > 0 &&
		      (current_deck.getCards().length > 0
		       ? $.table(
			   ...render_cards(current_deck.getCards()))
		       : $.span("This deck is empty")),
		  $.spacer(),
		  $.span(
		      $.button("Add card")
			  .att$('disabled', decks.length == 0)
			  .click$(()=>add_card()),
		      $.button("Export deck")
			  .att$('disabled', decks.length == 0)
			  .click$(()=>export_deck(current_deck.getIndex())),
		      $.button("Delete deck")
			  .att$('disabled', decks.length == 0)
			  .click$(()=>delete_deck(current_deck.getIndex()))
		  )
	      ).att$('id','cards'),
          ).att$('id', 'decks-tab')
    
    const learn_view = () =>
          $.div(
              $.span($.h1(`Welcome to ${APP_NAME}`)),
	      $.ul(
		  ...decks.map((deck, i)=>
		      $.li(
			  deck.name,
			  $.spacer(),
			  "New: " + deck.cards.filter(c=>c.state == card_state.NEW).length
		      ).click$(_e => learn(i)))
	      )
          ).att$('id','learn-tab')

    
    
    const welcome_view = () =>
	  $.div(
	      $.span($.h1(`Welcome to ${APP_NAME}`)),
	      $.p($.a("Create").att$('href', $.nohref).click$(_e=>add_deck()),
		  " a deck or ",
		  $.a("import").att$('href', $.nohref).click$(_e=>import_deck()),
		  " one")
	  ).att$('id','welcome')


    navigation = $.tabs(
	{
	    "Decks": decks_view,
	    "Learn": ()=>decks.length > 0
		? learn_view()
		: welcome_view()
	},
	LEARN_TAB
    )
    root.ch$(navigation)
    
    return root
}

document.addEventListener("DOMContentLoaded", ()=>{
    const body = document.querySelector('body')
    const head = document.querySelector('head')
    head.querySelector('title').innerText = `${APP_NAME}`
    body.setAttribute('theme', theme)
    body.appendChild(render())
})
