# Setting Up a An Example Bidding Tree

The bridge bidding analysis tool has a detailed and full featured syntax for defining very precise bidding structures.  However, this creates both major opportunities to examine bidding systems in minute detail while simultaneously allowing an inconsistent or incongruous system to be put in place.  To see how this works in principle, consider defining a seemingly simple response structure to a one notrump opening.  

## A Simple Attempt at Stayman and Transfers
Consider that you play Stayman, transfers, and 2NT as an invitational bid to 3NT.  Stayman shows a 4 card major and a transfer shows a 5 card major. For sake of example, we will treat 2NT as having 9 or 10 HCP, and 3NT showing 11 or more.  Defining the system might initially appear as straightforward as follows.  

* 1NT: 15-17 BAL
  * 2C: 9+ (4+H or 4+S)
  * 2D: 5+H
  * 2H: 5+S
  * 2N: 9-10 
  * 3N: 11+ 

## Eliminating Duplicate Bids
  Now consider the hand &spades;AT872, &hearts;K2, &diams;QT4, &clubs;J94.  Since the hand has 4 or more spades and 9 or more high card points, it falls under a 2C response.  Since it has 5 spades, it also falls under the 2H transfer response.  But it also would fall under the 2NT invitational bid as well.  Clearly such a hand has bidding exclusions.  In other words, you would choose to transfer the hand as your first choice of bids.  Given that, the 2N bid must be more precisely defined, as well as the 2C Stayman response.  So we will clarify the 2C bid to be exactly 4 in one of the majors.  Our first attempt might looking something like this:  

  * 1NT: 15-17 BAL
    * 2C: 9+ (4=H or 4=S)
    * 2D: 5+H
    * 2H: 5+S
    * 2N: 9-10 4-S 4-H 
    * 3N: 11+ 4-S 4-H

  ## What About Hnads That Are 5-4 in the Majors?

  Many people play a convention called Smolen, or instead just jump to the three level into their five card major after a Stayman bid to show a hand with 5-4 in the majors.  But clearly our currently system doesn't tackle this problem.  
  
  Not only that, but with 5-5 in the majors, we would transfer to spades first, then rebid hearts.  So it seems we need yet another update. We will make sure we don't bid 2D with 5-5 in the majors. We will update the Stayman response to hand 5-4 major hands, but this will also necessitate not transferring those hands.  We do so by expanding our Stayman response and then not transferring if we already used Stayman.  The '!' character represents 'not'.  In other words, don't transfer if we already bid Stayman with 5 of one major and 4 of the other.  

  * 1NT: 15-17 BAL
    * 2C: 9+ (4=H or 4=S or (5+S 4=H) or (4=S 5+H))
    * 2D: 5+H H>S !2C
    * 2H: 5+S !2C
    * 2N: 9-10 4-S 4-H 
    * 3N: 11+ 4-S 4-H
