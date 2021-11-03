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

// Suit comparison less than operator.  If you have two diamonds, and fewer clubs, it better be one or zero
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

// Suit comparison less than or equal operator.  If you have two diamonds, and same or fewer clubs, it zero to two.
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

////////////////    Primary and secondary suit tests     /////////////////
// You cannot have two primary suits
export const twoPrimarySuits =
{
    "value":
    {
        "constraint": {
            "type": "Conjunction",
            "constraints": [
                {
                    "type": "SuitPrimary",
                    "suit": "H"
                },
                {
                    "type": "SuitPrimary",
                    "suit": "S"
                }
            ]
        }
    },
    "actual": false
}

// You cannot have two secondary suits  (or can you?)
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

