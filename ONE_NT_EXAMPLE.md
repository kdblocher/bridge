# Setting Up a An Example Bidding Tree

The bridge bidding analysis tool has a detailed and full featured syntax for defining very precise bidding structures.  However, this creates both major opportunities to examine bidding systems in minute detail while simultaneously allowing an inconsistent or incongruous system to be put in place.  To see how this works in principle, consider defining a seemingly simple response structure to a 1N opening.  

## A Simple Attempt at Stayman and Transfers
Consider that you play Stayman, transfers, and 2N as an invitational bid to 3N.  Stayman shows a four card major and a transfer shows a five card major. For sake of example, we will treat 2N as having nine or ten HCP, and 3N showing eleven or more.  Defining the system might initially appear as straightforward as follows.  

* 1NT: 15-17 BAL
  * 2C: 9+ (4+H or 4+S)
  * 2D: 5+H
  * 2H: 5+S
  * 2N: 9-10 
  * 3N: 11+ 

## Eliminating Duplicate Bids
  Now consider the hand &spades;AT872, &hearts;K2, &diams;QT4, &clubs;J94.  Since the hand has four or more spades and nine or more high card points, it falls under a 2C response.  Since it has five spades, it also falls under the 2H transfer response.  But it also would fall under the 2N invitational bid as well.  Clearly such a hand has bidding exclusions.  In other words, you would choose to transfer the hand as your first choice of multiple matching bids.  Given that, the 2N bid must be more precisely defined, as well as the 2C Stayman response.  So we will clarify the 2C bid to be exactly four in one of the majors.  Both the 2N and 3N bid must have at most three cards in either major.  Our first attempt might looking something like this:  

  * 1NT: 15-17 BAL
    * 2C: 9+ (4=H or 4=S)
    * 2D: 5+H
    * 2H: 5+S
    * 2N: 9-10 3-S 3-H 
    * 3N: 11+ 3-S 3-H

  ## What About Hands That Are 5-4 in the Majors?

  Many people play a convention called Smolen, or instead just jump to the three level into their five card major after a Stayman bid to show a hand with five-four in the majors.  But clearly our currently defined system doesn't tackle this problem.  
  
  Not only that, but with five-five in the majors, we would transfer to spades first, then rebid hearts.  So it seems we need yet another update. We will make sure we don't bid 2D with five-five in the majors. We will update the Stayman response to hand five-four major hands, but this will also necessitate not transferring those hands.  We do so by expanding our Stayman response and then not transferring if we already used Stayman.  The '!' character represents 'not'.  In other words, don't transfer if we already bid Stayman with five of one major and four of the other.  

  * 1NT: 15-17 BAL
    * 2C: 9+ (4=H or 4=S or (5+S 4=H) or (4=S 5+H))
    * 2D: 5+H H>S !2C
    * 2H: 5+S !2C
    * 2N: 9-10 3-S 3-H 
    * 3N: 11+ 3-S 3-H

    ## Filling Out a More Extensive Opener Rebid

    For the case of transfers, of course the system will alow a fine granularity of super acceptance criteria.  For purposes of this example we will just choose an automatic bid of two of the major.  Notice there is no semi-colon after the acceptance bid. Filling out the responses to Stayman get a little easier, because the initial bid has already been defined.  Thus 2D is neither four card major, 2H shows four hearts, and 2S indicates four spades without also having four hearts.  

  * 1NT: 15-17 BAL
    * 2C: 9+ (4=H or 4=S or (5+S 4=H) or (4=S 5+H))
      * 2D: 3-H 3-S
      * 2H: 4+H
      * 2S: 4+S 3-H
    * 2D: 5+H H>S !2C -> 2H
      * 2H
    * 2H: 5+S !2C -> 2S
      * 2S
    * 2N: 9-10 3-S 3-H 
    * 3N: 11+ 3-S 3-H

Of course from here you could explore responder's rebids to Stayman or transfers, a minor suit relay system, or bids that investigate slam. The complexity of even the simplest structure may seem daunting, but by working in bite size chunks, you can explore various aspects of your system with fine detail.  