import { readonlyRecord } from 'fp-ts';

import { Constraint } from './system/core';
import { Syntax } from './system/expander';

export type DecodeTest = {
  value: string
  expected: Constraint
}

export const decodeTests: readonlyRecord.ReadonlyRecord<string, DecodeTest> = {
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
      "min": 4,
      "max": 0,
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
  }
}

interface ConstraintPropositionTest {
  value: Constraint
  expected: Constraint
}

export const constraintPropositionTests: readonlyRecord.ReadonlyRecord<string, ConstraintPropositionTest> = {

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
  }

}

interface ExpansionTest {
  value: Syntax
  expected: Constraint
}

export const syntaxPropositionTests: readonlyRecord.ReadonlyRecord<string, ExpansionTest> = {
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
      "type": "Conjunction",
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

  // Verify semibalanced shapes
  distSemiBalanced:
  {
    value:
    {
      "type": "SemiBalanced"
    },
    expected:
    {
      "type": "Conjunction",
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
        }
      ]
    }
  },

  // Verify unbalanced shapes
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
        }
      ]
    }
  },
}