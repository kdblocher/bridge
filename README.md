[![Tests](https://github.com/kdblocher/bridge/actions/workflows/test.yml/badge.svg)](https://github.com/kdblocher/bridge/actions/workflows/test.yml)
[![Build](https://github.com/kdblocher/bridge/actions/workflows/build.yml/badge.svg)](https://github.com/kdblocher/bridge/actions/workflows/build.yml)
[![CI/CD](https://github.com/kdblocher/bridge/actions/workflows/main.yml/badge.svg)](https://github.com/kdblocher/bridge/actions/workflows/main.yml)

# Contract Bridge System Analysis Tool

System analysis tool for the game of [Contract Bridge](https://en.wikipedia.org/wiki/Contract_bridge). Build a system book using human-readable syntax, and let the app get to work.

Created with [Create React App](https://github.com/facebook/create-react-app), using the [Redux](https://redux.js.org/) and [Redux Toolkit](https://redux-toolkit.js.org/) template.
Huge shout-out to [Giulio Canti](https://github.com/gcanti) for his amazing [fp-ts](https://github.com/gcanti/fp-ts) library, without which this app's code would be much more verbose.

## Demo
[Try it out](https://kdblocher.github.io/bridge/).

## License / Contributing
The project is still in its nascent stages, and code is highly subject to change. Furthermore, the author makes heavy use of higher-order functional programming techniques and will not accept pull requests that do not follow this paradigm.

If you still want to contribute, please read the [license](LICENSE.md) and [contributing guidelines](CONTRIBUTING.md) before submitting a PR. Happy hacking!

# Documentation

## Bidding Syntax
The system is comprised of a bidding tree, written in outline form. The top-level bullets are openings bids, and each level of nesting below represents a responding bid by partner (2nd level is opening responses, 3rd is opener rebids, etc.)

Each line should be of the following form:

``{Bid}: {Constraint}+``

The tool will attempt to parse each line into a [set of] constraints, which it then uses to match hands against it.

### Constraint Options

| Name | Syntax | Description | Examples |
| ---- | ------ | ----------- | -------- |
| Point Range | _min_ ``-`` _max_ <br /> _max_ ``-`` <br /> _min_ ``+`` | Holds if the [HCP](https://en.wikipedia.org/wiki/Hand_evaluation#High_card_points) of the hand falls between _min_ and _max_ (inclusive). | `12-14` <br /> `7-` <br /> `22+` |
| Suit Range | _min_ ``-`` _max_ _s_ <br /> _max_ ``-`` _s_ <br /> _min_ ``+`` _s_ | Holds if the length of suit _s_ falls between _min_ and _max_ (inclusive). `M` and `m` are allowed to specify majors or minors, respectively. | `2-3H` <br /> `4-S` <br /> `6+C` |
| Suit Comparison | _s_<sub>1</sub> _op_ _s_<sub>2</sub> <br /> _op_&nbsp;:=&nbsp;`<`&nbsp;`<=`&nbsp;`=`&nbsp;`>=`&nbsp;`>` | Holds if the comparison between the lengths of suits _s_<sub>1</sub> and _s_<sub>2</sub> is true. | `C>D` |
| Distribution | `BAL` <br /> `semiBAL` <br /> `unBAL` | Holds if the [hand distribution](https://en.wikipedia.org/wiki/Balanced_hand) is balanced, semi-balanced (includes balanced), or **unbalanced** (not balanced or semi-balanced), respectively. |
| Primary | _s_ `1` | Holds if _s_ is 5+ cards, longer than higher-ranking suits and at least as long as lower-ranking suits. | `H1` |
| Secondary | _s_ `2` | Holds if _s_ is 4+ cards, up to the length of the primary suit, but longer than the remaining two suits. | `C2` |
| Honors | _s_ _h_... | Holds if _s__ has all of the specific honor(s) _h_ (any of `AKQJT`). | `SAK` |
| Top X of Y | _s_ _x_ `/` _y_ | Holds if _s_ contains the top _x_ ranking cards out of the top _y_. | `S2/3` (AK/AQ/KQ) |
| Shape | _n<sub>&spades;</sub>_ _n<sub>&hearts;</sub>_ _n<sub>&diams;</sub>_ _n<sub>&clubs;</sub>_ <br /> _n<sub>1</sub>_ _n<sub>2</sub>_ _n<sub>3</sub>_ _n<sub>4</sub>_ `*` | Holds if the hand distribution is **exactly** _n_ (for each suit). <br /> Holds if the hand distribution is _n_ for **any** order of suits. | `4522` (3&hearts; rebid after [Flannery](https://www.bridgebum.com/flannery_2d.php)) <br /> `4441*` ([Multi 2&diams;](https://www.bridgebum.com/multi_2d.php)) |
| Response | `F1` <br /> `FG` <br /> `FS` | Marks the bid as [forcing](https://en.wikipedia.org/wiki/Forcing_bid) for one round, to game, or to slam (respectively). |
| Relay | `->` _b_ | Marks the bid as a [relay](https://en.wikipedia.org/wiki/Relay_bid) to bid _b_. <br/> Bids accepting the relay may simply name the bid without `:` ... to automatically accept the relay. | `2N: ->3C` <br/> &nbsp;&nbsp;&nbsp;`3C` (accepts relay) |
| Other Bid | _b_ | Holds when an alternative bid _b_ at the same level holds. (This is useful combined with the `not` / `!` operator.) | `1H: 5+H !1N` (don't bid 1&hearts; when 1NT is available) |
| Conjunction | _c_<sub>1</sub> &centerdot; _c_<sub>2</sub> ... | Holds if all constraints hold. | `11-15 4S 5H` |
| Disjunction | _c_<sub>1</sub> &centerdot; ``or`` &centerdot; _c_<sub>2</sub> ... |  Holds if any constraint holds. | `4414 or 4405 or 4315 or 3415` |
| Negation | `not` &centerdot; _c_ <br/> `!` &centerdot; _c_ | Holds when _c_ does not. | `not (14-15 BAL)`
| Grouping | `(`_c_`)` | Syntactic grouping of constraints _c_. | `6+C or (5+C 4M)` <br /> `(5-10 6+M) or (4441* 17-24)` |
| Constant | `true` <br /> `false` | Trivially holds (or not), respectively. |

- "**&centerdot;**" denotes a syntactic space between the terms in the syntax above. If there is no dot, do not space the terms.)
- "**...**" denotes terms that can be repeated indefinitely.
### Example Bidding Systems

[2/1 starter](Two_over_one_example.md)

[Notrump responses](ONE_NT_EXAMPLE.md)

## Hand Syntax
Hands are entered in PBN syntax (see [3.4.11](http://home.claranet.nl/users/veugent/pbn/pbn_v20.txt) for the full specification). They take the form ``{S}.{H}.{D}.{C}`` where each suit has zero or more single-digit rank identifiers (in any order): `AKQJT98765432`. (There must always be exactly three dots (``.``) so voids are distinguishable.)

An ``x`` may be used in place of any rank identifier to represent a spot card below ``T``.

### Sample Hands
- ``AQJ4.8732.T92.K9``
(equivalent to
<span style="color: #0000FF">&spades;</span>AQJ4
<span style="color: #FF0000">&hearts;</span>8732
<span style="color: #FFA500">&diams;</span>T92
<span style="color: #32CD32">&clubs;</span>K9
)
- ``AKQxx.Jxx..Qxxxx``
(equivalent to
<span style="color: #0000FF">&spades;</span>AKQxx
<span style="color: #FF0000">&hearts;</span>Jxx
<span style="color: #FFA500">&diams;</span>-
<span style="color: #32CD32">&clubs;</span>Qxxxx
)
