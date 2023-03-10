import { readonlyRecord as RR } from 'fp-ts';

import { Rank } from './deck';
import { Path } from './system';
import { Constraint } from './system/core';
import { SyntacticBid } from './system/expander';

export type DecodeTest = {
  value: string
  expected: Constraint
}

export const decodeTests: RR.ReadonlyRecord<string, DecodeTest> = {
  ////////////  HCP tests  //////////////////////
  // Make sure plus operator works as expected
  hcpPlusSyntax:
  {
    value: "7+",
    expected:
    {
      "type": "PointRange",
      "min": 7,
      "max": 37
    }
  },

  // Make sure minus operator works as expected
  hcpMinusSyntax:
  {
    value: "7-",
    expected:
    {
      "type": "PointRange",
      "min": 0,
      "max": 7
    }
  },
  // Make sure range operator works even when the values are identical
  hcpIdenticalPointCountSyntax:
  {
    value: "10-10",
    expected:
    {
      "type": "PointRange",
      "min": 10,
      "max": 10
    }
  },

  ////////////////  Suit length tests  //////////////////////
  // Suit length equality operator
  suitEqualitySyntax:
  {
    value: "5=H",
    expected:
    {
      "type": "SuitRange",
      "min": 5,
      "max": 5,
      "suit": "H"
    }
  },

  // Suit length plus operator
  suitPlusSyntax:
  {
    value: "4+H",
    expected:
    {
      "type": "SuitRange",
      "min": 4,
      "max": 13,
      "suit": "H"
    }
  },

  // Suit length minus operator
  suitMinusSyntax:
  {
    value: "4-H",
    expected:
    {
      "type": "SuitRange",
      "min": 0,
      "max": 4,
      "suit": "H"
    }
  },

  // Suit length range operator
  suitRangeSyntax:
  {
    value: "5-6H",
    expected:
    {
      "type": "SuitRange",
      "min": 5,
      "max": 6,
      "suit": "H"
    }
  },
  // Suit honor syntax
  suitHonorSyntax:
  {
    value: "SA",
    expected:
    {
      "type": "SuitHonors",
      "suit": "S",
      "honors": [
        14 as Rank
      ]
    }
  },

  // Suit honor syntax for multiple cards
  suiMultipletHonorSyntax:
  {
    value: "SAKQ",
    expected:
    {
      "type": "SuitHonors",
      "suit": "S",
      "honors": [
        14 as Rank,
        13 as Rank,
        12 as Rank
      ]
    }
  },
  // Top syntax
  suitTopSyntax:
  {
    value: "S2/3",
    expected:
    {
      "type": "SuitTop",
      "suit": "S",
      "count": 2,
      "minRank": 12 as Rank
    }
  },
}

interface ConstraintPropositionTest {
  value: Constraint
  expected: Constraint
}

// The first constraint implies the second. Both constraints are syntax.  Two rules; A implies B.  
export const constraintPropCompactTests: RR.ReadonlyRecord<string, [string, string]> = {
  // Point count tests
  // You cannot reverse point count syntax
  suitMixLessThanMax: ["7-0", "false"],

  // Suit length comparison tests
  // Reversed suit range should not generate anything
  suitReversal: ["6-5H", "false"],
  // If you have two diamonds, and fewer clubs, it had better be one or zero
  suitCompareLessThanOperator: ["2-2D C<D", "0-1C"],
  // If you have two diamonds, and same or fewer clubs, it zero to two.
  suitCompareLessThanOrEqualOperator: ["2-2D C<=D", "0-2C"],
  // If you have two hearts, and same diamonds, it had better be two.
  suitCompareEqualOperator: ["2-2H H=D", "2-2D"],
  // If you have two spades, and same or greater than hearts, you have zero or one hearts.
  suitCompareGreaterThanOrEqualOperator: ["2-2S S>=H", "0-2H"],
  // If you have two spades, and more spades than hearts, it had better be zero or one.
  suitCompareGreaterThanOperator: ["2-2S S>H", "0-1H"],
  // If you have four spades, equal hearts to spades, and equal diamonds to hearts, you should have four diamonds.
  multpleSuitCompareEqualOperator: ["4-4S S=H H=D", "4441"],
  // You cannot have two secondary suits 
  twoSecondarySuits: ["H2 S2", "false"],
  // You cannot have the same suit be both primary and secondary   TODO: Currently logged as Gitlab issue #191
  //sameSuitPrimaryAndSecondary: ["S1 S2", "false"],
  // Make sure a secondary five card suit does not prevent a higher five card suit from being primary
  setPrimaryAsHigherSuit: ["S1 5-5D", "5-8S"],
  // Correllary to previous test.  Make sure a five card higher ranking suit results in a six plus card primary
  setPrimaryAsLowerSuit: ["D1 5-5S", "6-7D"],

  // Top x of y tests
  //  Does Top two or three actually give you two of the top three honors
  suitTopTwoOfThreeHonors: ["H2/3", "HAK or HAQ or HKQ"],
  //  If you have two of top four, but not two of top three, you must have the Jack
  multipleSuitTopHonorCombinations: ["S2/4 !S2/3", "SJ"],
  //  You cannot have more cards in your top than in the suit
  suitTopMoreThanSuitTotal: ["C3/4 0-2C", "false"],
  //  You cannot have two of top three honors, and 0-4 HCP
  suitTopMoreThanHCP: ["D2/3 0-4", "false"],
  //  You cannot have three of the top two honors
  suitTopMReversed: ["H3/2", "false"],

  // Negation tests
  //  Selecting two "nots" is equivalent to a simple point range
  hcpDoubleRangeNegation: ["!0-14 !18-37","15-17"],
  //  Selecting "NOT" a suit range means either less then the min or more then the max
  suitRangeNegation: ["!2-5S","0-1S or 6+S"],
  //  A and not(A) is always false.  Negate a primary suit
  primarySuitLogicalNegation:["H1 !H1", "false"],
}


// This section of tests is based on equality.  The first syntax is equivalent to the second.  
export const syntaxPropCompactTests: RR.ReadonlyRecord<string, [string, string]> = {
  // // Verify balanced shapes
  distBalanced: ["BAL", "4333* or 4432* or 5332*"],
  // Verify semibalanced shapes  (includes all balanced hands as well)
  distSemiBalanced: ["semiBAL", "5422* or 6322* or 4333* or 4432* or 5332*"],
  // Verify unbalanced shapes  (anyting with singleton or void, or 7222)
  distUnBalanced: ["unBAL", "1-C or 1-D or 1-H or 1-S or 7222*"],
}

interface ExpansionPathValidTest {
  value: Path<SyntacticBid>
  expected: boolean
}

export const expansionPathValidTests: RR.ReadonlyRecord<string, ExpansionPathValidTest> = {
  openerResponderDifferentPrimarySuits: {
    value: [
      { bid: { level: 1, strain: "S" },
        syntax: {
          type: "Conjunction",
          syntax: [
            {
              type: "Wrapper",
              constraint: {
                type: "PointRange",
                min: 13,
                max: 21
              }
            },
            {
              type: "SuitPrimary",
              suit: "S"
            }
          ]
        }
      },
      { bid: { level: 2, strain: "C" },
        syntax: {
          type: "Conjunction",
          syntax: [
            {
              type: "Wrapper",
              constraint: {
                type: "PointRange",
                min: 10,
                max: 37
              }
            },
            {
              type: "SuitPrimary",
              suit: "C"
            }
          ]
        }
      }
    ],
    expected: true
  }
}

// This group of tests is first entity is north hand, while the second is the south hand.  The implication is that all these must be FALSE 
export const partnershipOverlappingTestsFalse: RR.ReadonlyRecord<string, [string, string]> = {
  'Both hands cannot hold SK': ["SK", "SK"],
  'Both hands cannot have 7 hearts': ["7+H", "7+H"],
  'Both hands cannot hold the top 3 of 4 honors in the same suit': ["S3/4", "S3/4"],
}

// This group of tests is first entity is north hand, while the second is the south hand.  The implication is that all these must be TRUE 
export const partnershipOverlappingTestsTrue: RR.ReadonlyRecord<string, [string, string]> = {
}