import { readonlyRecord as RR } from 'fp-ts';
import { Either } from 'fp-ts/lib/Either';

import { Rank, rankFromString } from './deck';
import { Path } from './system';
import { ConstrainedBid, Constraint } from './system/core';
import { SyntacticBid, Syntax } from './system/expander';

export type DecodeTest = {
  value: string
  expected: Constraint
}


// This section tests the expansion of the syntax only  
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
  // Suit honor syntax Ace
  suitHonorSyntaxAce:
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
  // Suit honor syntax King
  suitHonorSyntaxKing:
  {
    value: "HK",
    expected:
    {
      "type": "SuitHonors",
      "suit": "H",
      "honors": [
        13 as Rank
      ]
    }
  },
    // Suit honor syntax Queen
    suitHonorSyntaxQueen:
    {
      value: "DQ",
      expected:
      {
        "type": "SuitHonors",
        "suit": "D",
        "honors": [
          12 as Rank
        ]
      }
    },
        // Suit honor syntax Jack
        suitHonorSyntaxJack:
        {
          value: "CJ",
          expected:
          {
            "type": "SuitHonors",
            "suit": "C",
            "honors": [
              11 as Rank
            ]
          }
        },
          // Suit honor syntax Queen
    suitHonorSyntaxTen:
    {
      value: "ST",
      expected:
      {
        "type": "SuitHonors",
        "suit": "S",
        "honors": [
          10 as Rank
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
  }
}
interface ConstraintPropositionTest {
  value: Constraint
  expected: Constraint
}

// This section tests whether constraints can conflict with each other  
export const constraintPropositionTests: RR.ReadonlyRecord<string, ConstraintPropositionTest> = {

  // Min should never be more than max
  hcpReversal:
  {
    value:
    {
      "type": "PointRange",
      "min": 7,
      "max": 0
    },
    expected: {
      "type": "Constant",
      value: false
    }
  },
  // Reversed suit range should not generate anything
  suitReversal:
  {
    value:
    {
      "type": "SuitRange",
      "min": 6,
      "max": 5,
      "suit": "H"
    },
    expected: {
      "type": "Constant",
      value: false
    }
  },

  ////////////////  Suit comparison tests  //////////////////////
  // Add tests later to test the parsing. For now, verify the hands generate as expected

  // Suit comparison less than operator.  
  // If you have two diamonds, and fewer clubs, it had better be one or zero
  suitCompareLessThanOperator:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitRange",
          "min": 2,
          "max": 2,
          "suit": "D"
        },
        {
          "type": "SuitComparison",
          "op": "<",
          "left": "C",
          "right": "D"
        }
      ]
    },
    expected:
    {
      "type": "SuitRange",
      "min": 0,
      "max": 1,
      "suit": "C"
    }
  },

  // Suit comparison less than or equal operator.  
  // If you have two diamonds, and same or fewer clubs, it zero to two.
  suitCompareLessThanOrEqualOperator:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitRange",
          "min": 2,
          "max": 2,
          "suit": "D"
        },
        {
          "type": "SuitComparison",
          "op": "<=",
          "left": "C",
          "right": "D"
        }
      ]
    },
    expected:
    {
      "type": "SuitRange",
      "min": 0,
      "max": 2,
      "suit": "C"

    }
  },

  // Suit comparison equal operator.  
  // If you have two hearts, and same spades, it had better be two.
  suitCompareEqualOperator:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitRange",
          "min": 2,
          "max": 2,
          "suit": "H"
        },
        {
          "type": "SuitComparison",
          "op": "=",
          "left": "H",
          "right": "D"
        }
      ]
    },
    expected:
    {
      "type": "SuitRange",
      "min": 2,
      "max": 2,
      "suit": "D"
    }
  },

  // Suit comparison greater than or equal operator.  
  // If you have two spades, and same or greater than hearts, you have zero or one hearts.
  suitCompareGreaterThanOrEqualOperator:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitRange",
          "min": 2,
          "max": 2,
          "suit": "S"
        },
        {
          "type": "SuitComparison",
          "op": ">=",
          "left": "S",
          "right": "H"
        }
      ]
    },
    expected:
    {
      "type": "SuitRange",
      "min": 0,
      "max": 2,
      "suit": "H"
    }
  },

  // Suit comparison greater than.  
  // If you have two spades, and more spades than hearts, it had better be zero or one.
  suitCompareGreaterThanOperator:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitRange",
          "min": 2,
          "max": 2,
          "suit": "S"
        },
        {
          "type": "SuitComparison",
          "op": ">",
          "left": "S",
          "right": "H"
        }
      ]
    },
    expected:
    {
      "type": "SuitRange",
      "min": 0,
      "max": 1,
      "suit": "H"
    }
  },

  // Multiple suit comparison operators.  
  // If you have four spades, equal hearts to spades, and equal diamonds to hearts, you should have four diamonds.
  multpleSuitCompareEqualOperator:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitRange",
          "min": 4,
          "max": 4,
          "suit": "S"
        },
        {
          "type": "SuitComparison",
          "op": "=",
          "left": "S",
          "right": "H"
        },
        {
          "type": "SuitComparison",
          "op": "=",
          "left": "H",
          "right": "D"
        }
      ]
    },
    expected:
    {
      "type": "SpecificShape",
      "suits":
      {
        "S": 4,
        "H": 4,
        "D": 4,
        "C": 1
      }
    }
  },

  // You cannot have two secondary suits 
  twoSecondarySuits:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitSecondary",
          "suit": "H"
        },
        {
          "type": "SuitSecondary",
          "suit": "S"
        }
      ]
    },
    expected: {
      "type": "Constant",
      value: false
    }
  },

  // You cannot have the same suit be both primary and secondary
  sameSuitPrimaryAndSecondary:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitPrimary",
          "suit": "S"
        },
        {
          "type": "SuitSecondary",
          "suit": "S"
        }
      ]
    },
    expected: {
      "type": "Constant",
      value: false
    }
  },

  // Make sure a secondary five card suit does not prevent a higher five card suit from being primary
  setPrimaryAsHigherSuit:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitPrimary",
          "suit": "S"
        },
        {
          "type": "SuitRange",
          "min": 5,
          "max": 5,
          "suit": "D"
        }
      ]
    },
    expected:
    {
      "type": "SuitRange",
      "min": 5,
      "max": 8,
      "suit": "S"
    }
  },

  // Correllary to previous test.  Make sure a five card higher ranking suit results in a six plus card primary
  setPrimaryAsLowerSuit:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitPrimary",
          "suit": "D"
        },
        {
          "type": "SuitRange",
          "min": 5,
          "max": 5,
          "suit": "S"
        }
      ]
    },
    expected:
    {
      "type": "SuitRange",
      "min": 6,
      "max": 7,
      "suit": "D"
    }
  },
  //  Does Top two or three actually give you two of the top three honors
  suitTopTwoOfThreeHonors:
  {
    value:
    {
      "type": "SuitTop",
      "suit": "H",
      "count": 2,
      "minRank": 12 as Rank
    },
    expected:
    {
      "type": "Disjunction",
      "constraints": [
        {
          "type": "SuitHonors",
          "suit": "H",
          "honors": [
            14 as Rank,
            13 as Rank
          ]
        },
        {
          "type": "SuitHonors",
          "suit": "H",
          "honors": [
            14 as Rank,
            12 as Rank
          ]
        },
        {
          "type": "SuitHonors",
          "suit": "H",
          "honors": [
            13 as Rank,
            12 as Rank
          ]
        }
      ]
    }
  },
  //  If you have two of top four, but not two of top three, you must have the Jack
  multipleSuitTopHonorCombinations:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitTop",
          "suit": "D",
          "count": 2,
          "minRank": 11 as Rank
        },
        {
          "type": "Negation",
          "constraint": {
            "type": "SuitTop",
            "suit": "D",
            "count": 2,
            "minRank": 12 as Rank
          }
        }
      ]
    },
    expected:
    {
      "type": "SuitHonors",
      "suit": "D",
      "honors": [
        11 as Rank
      ]
    }
  },
  //  You cannot have more cards in your top than in the suit
  suitTopMoreThanSuitTotal:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "SuitTop",
          "suit": "C",
          "count": 3,
          "minRank": 10 as Rank
        },
        {
          "type": "SuitRange",
          "min": 2,
          "max": 2,
          "suit": "C"
        }
      ]
    },
    expected: {
      "type": "Constant",
      value: false
    }
  },
  //  You cannot have two of top three honors, and 0-4 HCP
  suitTopMoreThanHCP:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "PointRange",
          "min": 0,
          "max": 4
        },
        {
          "type": "SuitTop",
          "suit": "C",
          "count": 2,
          "minRank": 12 as Rank
        }
      ]
    },
    expected: {
      "type": "Constant",
      value: false
    }
  },
  //  You cannot have three of the top two honors
  suitTopMReversed:
  {
    value:
    {
      "type": "SuitTop",
      "suit": "C",
      "count": 3,
      "minRank": 13 as Rank
    },
    expected: 
    {
      "type": "Constant",
      value: false
    }
  },

  // Negation tests
  //  Selecting two "nots" is equivalent to a simple point range
  hcpDoubleRangeNegation:
  {
    value:
    {
      "type": "Conjunction",
      "constraints": [
        {
          "type": "Negation",
          "constraint": {
            "type": "PointRange",
            "min": 0,
            "max": 14
          }
        },
        {
          "type": "Negation",
          "constraint": {
            "type": "PointRange",
            "min": 18,
            "max": 37
          }
        }
      ]
    },
    expected:
    {
      "type": "PointRange",
      "min": 15,
      "max": 17

    }
  },

  //  Selecting "NOT" a suit range means either less then the min or more then the max
  suitRangeNegation:
  {
    value:
    {
      "type": "Negation",
      "constraint": {
        "type": "SuitRange",
        "min": 2,
        "max": 5,
        "suit": "H"
      }
    },
    expected:
    {
      "type": "Disjunction",
      "constraints": [
        {
          "type": "SuitRange",
          "min": 0,
          "max": 1,
          "suit": "H"
        },
        {
          "type": "SuitRange",
          "min": 6,
          "max": 13,
          "suit": "H"
        }
      ]
    }
  },
//  A and not(A) is always false.  Negate a primary suit
primarySuitLogicalNegation:
  {
    value:
    {
        "type": "Conjunction",
        "constraints": [
          {
            "type": "SuitPrimary",
            "suit": "H"
          },
          {
            "type": "Negation",
            "constraint": {
              "type": "SuitPrimary",
              "suit": "H"
            }
          }
        ]
      },
    expected:
    {
      "type": "Constant",
      value: false
    }
  }
}

interface ExpansionTest {
  value: Syntax
  expected: Constraint
}

// This section tests for syntax expansion 
export const syntaxPropositionTests: RR.ReadonlyRecord<string, ExpansionTest> = {
  // ////////////////  Distribution tests   /////////////////
  // // Verify balanced shapes
  distBalanced:
  {
    value:
    {
      "type": "Balanced"
    },
    expected:
    {
      "type": "Disjunction",
      "constraints": [
        {
          "type": "AnyShape",
          "counts": [
            4,
            3,
            3,
            3
          ]
        },
        {
          "type": "AnyShape",
          "counts": [
            4,
            4,
            3,
            2
          ]
        },
        {
          "type": "AnyShape",
          "counts": [
            5,
            3,
            3,
            2
          ]
        }
      ]
    }
  },

  // Verify semibalanced shapes  (includes all balanced hands as well)
  distSemiBalanced:
  {
    value:
    {
      "type": "SemiBalanced"
    },
    expected:
    {
      "type": "Disjunction",
      "constraints": [
        {
          "type": "AnyShape",
          "counts": [
            5,
            4,
            2,
            2
          ]
        },
        {
          "type": "AnyShape",
          "counts": [
            6,
            3,
            2,
            2
          ]
        },
        {
          "type": "AnyShape",
          "counts": [
            4,
            3,
            3,
            3
          ]
        },
        {
          "type": "AnyShape",
          "counts": [
            4,
            4,
            3,
            2
          ]
        },
        {
          "type": "AnyShape",
          "counts": [
            5,
            3,
            3,
            2
          ]
        }
      ]
    }
  },

  // Verify unbalanced shapes  (anyting with singleton or void, or 7222)
  distUnBalanced:
  {
    value:
    {
      "type": "Unbalanced"
    },
    expected:
    {
      "type": "Disjunction",
      "constraints": [
        {
          "type": "SuitRange",
          "min": 0,
          "max": 1,
          "suit": "C"
        },
        {
          "type": "SuitRange",
          "min": 0,
          "max": 1,
          "suit": "D"
        },
        {
          "type": "SuitRange",
          "min": 0,
          "max": 1,
          "suit": "H"
        },
        {
          "type": "SuitRange",
          "min": 0,
          "max": 1,
          "suit": "S"
        },
        {
          "type": "AnyShape",
          "counts": [
            7,
            2,
            2,
            2
          ]
        }
      ]
    }
  },
}

interface ExpansionPathValidTest {
  value: Path<SyntacticBid>
  expected: boolean
}

// This section tests that bidding paths make sense  
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