// Veryifying all bids and shapes
export const allPossibleNids =
    ['1C', '1D', '1H', '1S', '1N'
        , '2C', '2D', '2H', '2S', '2N'
        , '3C', '3D', '3H', '3S', '3N'
        , '4C', '4D', '4H', '4S', '4N'
        , '5C', '5D', '5H', '5S', '5N'
        , '6C', '6D', '6H', '6S', '6N'
        , '7C', '7D', '7H', '7S', '7N'
        , 'P'
    ]

export const allPossibleShapes =
    ['bal', 'semibal', 'unabl'
    ]

////////////    HCP tests    //////////////////////
// Make sure plus operator works as expected
export const hcpPlusSyntax =
{
    "value": "7+",
    "actual":
    {
        "constraint":
        {
            "type": "PointRange",
            "min": 7,
            "max": 37
        }
    }
}

// Make sure minus operator works as expected
export const hcpMinusSyntax =
{
    "value": "7-",
    "actual":
    {
        "constraint":
        {
            "type": "PointRange",
            "min": 0,
            "max": 7
        }
    }
}

// Min should never be more than max
export const hcpReversal =
{
    "value":
    {
        "constraint":
        {
            "type": "PointRange",
            "min": 7,
            "max": 0
        }
    },
    "actual": false
}

////////////////    Suit length tests    //////////////////////
// Suit length equality operator
export const suitEqualitySyntax =
{
    "value": "5=H",
    "actual":
    {
        "constraint": {
            "type": "SuitRange",
            "min": 5,
            "max": 5,
            "suit": "H"
        }
    }
}

// Suit length plus operator
export const suitPlusSyntax =
{
    "value": "4+H",
    "actual":
    {
        "constraint": {
            "type": "SuitRange",
            "min": 4,
            "max": 13,
            "suit": "H"
        }
    }
}

// Suit length minus operator
export const suitMinusSyntax =
{
    "value": "4-H",
    "actual":
    {
        "constraint": {
            "type": "SuitRange",
            "min": 4,
            "max": 0,
            "suit": "H"
        }
    }
}

// Suit length range operator
export const suitRangeSyntax =
{
    "value": "5-6H",
    "actual":
    {
        "constraint":
        {
            "type": "SuitRange",
            "min": 5,
            "max": 6,
            "suit": "H"
        }
    }
}

// Reversed suit range should not generate anything
export const suitReversal =
{
    "value":
    {
        "constraint":
        {
            "type": "SuitRange",
            "min": 6,
            "max": 5,
            "suit": "H"
        }
    },
    "actual": false
}

////////////////    Suit comparison tests    //////////////////////
// Add tests later to test the parsing. For now, verify the hands generate as expected

// Suit comparison less than operator.  
// If you have two diamonds, and fewer clubs, it had better be one or zero
export const suitCompareLessThanOperator =
{
    "value":
    {
        "constraint": 
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
        }
    },
    "actual":
    {
        "type": "SuitRange",
        "min": 0,
        "max": 1,
        "suit": "C"

    }
}

// Suit comparison less than or equal operator.  
// If you have two diamonds, and same or fewer clubs, it zero to two.
export const suitCompareLessThanOrEqualOperator =
{
    "value":
    {
        "constraint": 
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
        }
    },
    "actual":
    {
        "type": "SuitRange",
        "min": 0,
        "max": 2,
        "suit": "C"

    }
}

// Suit comparison equal operator.  
// If you have two hearts, and same spades, it had better be two.
export const suitCompareEqualOperator =
{
    "value":
    {
        "constraint":
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
        }
    },
    "actual":
    {
        "type": "SuitRange",
        "min": 2,
        "max": 2,
        "suit": "D"

    }
}

// Suit comparison greater than or equal operator.  
// If you have two spades, and same or greater than hearts, you have zero or one hearts.
export const suitCompareGreaterThanOrEqualOperator =
{
    "value":
    {
        "constraint":
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
        }
    },
    "actual":
    {
        "type": "SuitRange",
        "min": 0,
        "max": 2,
        "suit": "H"

    }
}

// Suit comparison greater than.  
// If you have two spades, and more spades than hearts, it had better be zero or one.
export const suitCompareGreaterThanOperator =
{
    "value":
    {
        "constraint":
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
        }
    },
    "actual":
    {
        "type": "SuitRange",
        "min": 0,
        "max": 1,
        "suit": "H"

    }
}

// Multiple suit comparison operators.  
// If you have four sapdes, equal hearts to spades, and equal diamonds to hearts, you should have four diamonds.
export const multpleSuitCompareEqualOperator =
{
    "value":
    {
        "constraint":
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
        }
    },
    "actual":
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
}

////////////////    Distribution tests     /////////////////

// Verify balanced shapes
export const distBalanced =
{
    "value":
    {
        "constraint": {
            "type": "Balanced"
        }
    },
    "actual":
    {
        "constraint": {
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
    }
}

// Verify semibalanced shapes
export const distSemiBalanced =
{
    "value":
    {
        "constraint": {
            "type": "SemiBalanced"
        }
    },
    "actual":
    {
        "constraint": {
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
    }
}

// Verify unbalanced shapes
export const distUnBalanced =
{
    "value":
    {
        "constraint": {
            "type": "Unbalanced"
        }
    },
    "actual":
    {
        "constraint": {
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
    }
}

// You cannot have two secondary suits 
export const twoSecondarySuits =
{
    "value":
    {
        "constraint": {
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
        }
    },
    "actual": false
}

// You cannot have the same suit be both primary and secondary
export const sameSuitPrimaryAndSecondary =
{
    "value":
    {
        "constraint": {
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
        }
    },
    "actual": false
}

// Make sure a secondary five card suit does not prevent a higher five card suit from being primary
export const setPrimaryAsHigherSuit =
{
    "value":
    {
        "constraint": {
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
        "actual":
        {
            "type": "SuitRange",
            "min": 5,
            "max": 8,
            "suit": "S"
        }
    }
}

// Correllary to previous test.  Make sure a five card higher ranking suit results in a six plus card primary
export const setPrimaryAsLowerSuit =
{
    "value":
    {
        "constraint": {
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
        }
    },
    "actual":
    {
        "type": "SuitRange",
        "min": 6,
        "max": 7,
        "suit": "D"
    }
}

