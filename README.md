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

### Bidding Syntax
The system is comprised of a bidding tree, written in outline form. The top-level bullets are openings bids, and each level of nesting below represents a responding bid by partner (2nd level is opening responses, 3rd is opener rebids, etc.)

Each line should be of the following form:

``{Bid}: {Constraint}+``

The tool will attempt to parse each line 
#### Sample Bidding System

Here is a sample stub for a 2 over 1-based system. You can copy/paste this tree into the tool and extend it.

- ``1C: 11-21 3+C 4-M``
  - ``1H: 6+ 4+H``
    - ``1N: 12-14 BAL 3-S``
  - ``1S: 6+ 4+S``
    - ``1N: 12-14 BAL``
- ``1D: 11-21 3+D 4-M``
  - ``1H: 6+ 4+H``
    - ``1N: 12-14 BAL``
  - ``1S: 6+ 4+S``
    - ``1N: 12-14 BAL``
- ``1H: 11-21 5+H``
  - ``1S: 6+ 4+S``
    - ``1N: 12-14 BAL 3-S``
- ``1S: 11-21 5+S``
  - ``1N: 5-12 F1``
- ``1N: 15-17 BAL``
- ``2C: 22+``
  - ``2D: 7-``
- ``2D: 5-11 6+D``
- ``2H: 5-11 6+H``
- ``2S: 5-11 6+S``
- ``2N: 20-21 semiBAL``

### Hand Syntax
Hands are entered in PBN syntax (see [3.4.11](http://home.claranet.nl/users/veugent/pbn/pbn_v20.txt) for the full specification). They take the form ``{S}.{H}.{D}.{C}`` where each suit has zero or more single-digit rank identifiers (in any order): `AKQJT98765432`. (There must always be exactly three dots (``.``) so voids are distinguishable.)

An ``x`` may be used in place of any rank identifier to represent a spot card below ``T``.

#### Sample Hands
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