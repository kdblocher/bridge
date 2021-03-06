// This code was generated by `SqlHydra.SqlServer` -- v0.530.0.0.
namespace Database

type Column(reader: System.Data.IDataReader, getOrdinal: string -> int, column) =
        member __.Name = column
        member __.IsNull() = getOrdinal column |> reader.IsDBNull
        override __.ToString() = __.Name

type RequiredColumn<'T, 'Reader when 'Reader :> System.Data.IDataReader>(reader: 'Reader, getOrdinal, getter: int -> 'T, column) =
        inherit Column(reader, getOrdinal, column)
        member __.Read(?alias) = alias |> Option.defaultValue __.Name |> getOrdinal |> getter

type OptionalColumn<'T, 'Reader when 'Reader :> System.Data.IDataReader>(reader: 'Reader, getOrdinal, getter: int -> 'T, column) =
        inherit Column(reader, getOrdinal, column)
        member __.Read(?alias) = 
            match alias |> Option.defaultValue __.Name |> getOrdinal with
            | o when reader.IsDBNull o -> None
            | o -> Some (getter o)

type RequiredBinaryColumn<'T, 'Reader when 'Reader :> System.Data.IDataReader>(reader: 'Reader, getOrdinal, getValue: int -> obj, column) =
        inherit Column(reader, getOrdinal, column)
        member __.Read(?alias) = alias |> Option.defaultValue __.Name |> getOrdinal |> getValue :?> byte[]

type OptionalBinaryColumn<'T, 'Reader when 'Reader :> System.Data.IDataReader>(reader: 'Reader, getOrdinal, getValue: int -> obj, column) =
        inherit Column(reader, getOrdinal, column)
        member __.Read(?alias) = 
            match alias |> Option.defaultValue __.Name |> getOrdinal with
            | o when reader.IsDBNull o -> None
            | o -> Some (getValue o :?> byte[])
        
module dbo =
    type deals =
        { deal: byte []
          shape_north: int16
          shape_east: int16
          shape_south: int16
          shape_west: int16
          hcp_north: byte
          hcp_east: byte
          hcp_south: byte
          hcp_west: byte
          tricks_north_clubs: Option<byte>
          tricks_north_diamonds: Option<byte>
          tricks_north_hearts: Option<byte>
          tricks_north_spades: Option<byte>
          tricks_north_notrump: Option<byte>
          tricks_east_clubs: Option<byte>
          tricks_east_diamonds: Option<byte>
          tricks_east_hearts: Option<byte>
          tricks_east_spades: Option<byte>
          tricks_east_notrump: Option<byte>
          tricks_south_clubs: Option<byte>
          tricks_south_diamonds: Option<byte>
          tricks_south_hearts: Option<byte>
          tricks_south_spades: Option<byte>
          tricks_south_notrump: Option<byte>
          tricks_west_clubs: Option<byte>
          tricks_west_diamonds: Option<byte>
          tricks_west_hearts: Option<byte>
          tricks_west_spades: Option<byte>
          tricks_west_notrump: Option<byte>
          par_north_nonevul: Option<int16>
          par_east_nonevul: Option<int16>
          par_south_nonevul: Option<int16>
          par_west_nonevul: Option<int16>
          par_north_nsvul: Option<int16>
          par_east_nsvul: Option<int16>
          par_south_nsvul: Option<int16>
          par_west_nsvul: Option<int16>
          par_north_ewvul: Option<int16>
          par_east_ewvul: Option<int16>
          par_south_ewvul: Option<int16>
          par_west_ewvul: Option<int16>
          par_north_allvul: Option<int16>
          par_east_allvul: Option<int16>
          par_south_allvul: Option<int16>
          par_west_allvul: Option<int16>
          when_dealt: Option<System.DateTime> }

    type dealsReader(reader: Microsoft.Data.SqlClient.SqlDataReader, getOrdinal) =
        member __.deal = RequiredBinaryColumn(reader, getOrdinal, reader.GetValue, "deal")
        member __.shape_north = RequiredColumn(reader, getOrdinal, reader.GetInt16, "shape_north")
        member __.shape_east = RequiredColumn(reader, getOrdinal, reader.GetInt16, "shape_east")
        member __.shape_south = RequiredColumn(reader, getOrdinal, reader.GetInt16, "shape_south")
        member __.shape_west = RequiredColumn(reader, getOrdinal, reader.GetInt16, "shape_west")
        member __.hcp_north = RequiredColumn(reader, getOrdinal, reader.GetByte, "hcp_north")
        member __.hcp_east = RequiredColumn(reader, getOrdinal, reader.GetByte, "hcp_east")
        member __.hcp_south = RequiredColumn(reader, getOrdinal, reader.GetByte, "hcp_south")
        member __.hcp_west = RequiredColumn(reader, getOrdinal, reader.GetByte, "hcp_west")
        member __.tricks_north_clubs = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_north_clubs")
        member __.tricks_north_diamonds = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_north_diamonds")
        member __.tricks_north_hearts = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_north_hearts")
        member __.tricks_north_spades = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_north_spades")
        member __.tricks_north_notrump = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_north_notrump")
        member __.tricks_east_clubs = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_east_clubs")
        member __.tricks_east_diamonds = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_east_diamonds")
        member __.tricks_east_hearts = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_east_hearts")
        member __.tricks_east_spades = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_east_spades")
        member __.tricks_east_notrump = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_east_notrump")
        member __.tricks_south_clubs = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_south_clubs")
        member __.tricks_south_diamonds = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_south_diamonds")
        member __.tricks_south_hearts = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_south_hearts")
        member __.tricks_south_spades = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_south_spades")
        member __.tricks_south_notrump = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_south_notrump")
        member __.tricks_west_clubs = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_west_clubs")
        member __.tricks_west_diamonds = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_west_diamonds")
        member __.tricks_west_hearts = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_west_hearts")
        member __.tricks_west_spades = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_west_spades")
        member __.tricks_west_notrump = OptionalColumn(reader, getOrdinal, reader.GetByte, "tricks_west_notrump")
        member __.par_north_nonevul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_north_nonevul")
        member __.par_east_nonevul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_east_nonevul")
        member __.par_south_nonevul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_south_nonevul")
        member __.par_west_nonevul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_west_nonevul")
        member __.par_north_nsvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_north_nsvul")
        member __.par_east_nsvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_east_nsvul")
        member __.par_south_nsvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_south_nsvul")
        member __.par_west_nsvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_west_nsvul")
        member __.par_north_ewvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_north_ewvul")
        member __.par_east_ewvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_east_ewvul")
        member __.par_south_ewvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_south_ewvul")
        member __.par_west_ewvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_west_ewvul")
        member __.par_north_allvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_north_allvul")
        member __.par_east_allvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_east_allvul")
        member __.par_south_allvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_south_allvul")
        member __.par_west_allvul = OptionalColumn(reader, getOrdinal, reader.GetInt16, "par_west_allvul")
        member __.when_dealt = OptionalColumn(reader, getOrdinal, reader.GetDateTime, "when_dealt")
        member __.Read() =
            { deal = __.deal.Read()
              shape_north = __.shape_north.Read()
              shape_east = __.shape_east.Read()
              shape_south = __.shape_south.Read()
              shape_west = __.shape_west.Read()
              hcp_north = __.hcp_north.Read()
              hcp_east = __.hcp_east.Read()
              hcp_south = __.hcp_south.Read()
              hcp_west = __.hcp_west.Read()
              tricks_north_clubs = __.tricks_north_clubs.Read()
              tricks_north_diamonds = __.tricks_north_diamonds.Read()
              tricks_north_hearts = __.tricks_north_hearts.Read()
              tricks_north_spades = __.tricks_north_spades.Read()
              tricks_north_notrump = __.tricks_north_notrump.Read()
              tricks_east_clubs = __.tricks_east_clubs.Read()
              tricks_east_diamonds = __.tricks_east_diamonds.Read()
              tricks_east_hearts = __.tricks_east_hearts.Read()
              tricks_east_spades = __.tricks_east_spades.Read()
              tricks_east_notrump = __.tricks_east_notrump.Read()
              tricks_south_clubs = __.tricks_south_clubs.Read()
              tricks_south_diamonds = __.tricks_south_diamonds.Read()
              tricks_south_hearts = __.tricks_south_hearts.Read()
              tricks_south_spades = __.tricks_south_spades.Read()
              tricks_south_notrump = __.tricks_south_notrump.Read()
              tricks_west_clubs = __.tricks_west_clubs.Read()
              tricks_west_diamonds = __.tricks_west_diamonds.Read()
              tricks_west_hearts = __.tricks_west_hearts.Read()
              tricks_west_spades = __.tricks_west_spades.Read()
              tricks_west_notrump = __.tricks_west_notrump.Read()
              par_north_nonevul = __.par_north_nonevul.Read()
              par_east_nonevul = __.par_east_nonevul.Read()
              par_south_nonevul = __.par_south_nonevul.Read()
              par_west_nonevul = __.par_west_nonevul.Read()
              par_north_nsvul = __.par_north_nsvul.Read()
              par_east_nsvul = __.par_east_nsvul.Read()
              par_south_nsvul = __.par_south_nsvul.Read()
              par_west_nsvul = __.par_west_nsvul.Read()
              par_north_ewvul = __.par_north_ewvul.Read()
              par_east_ewvul = __.par_east_ewvul.Read()
              par_south_ewvul = __.par_south_ewvul.Read()
              par_west_ewvul = __.par_west_ewvul.Read()
              par_north_allvul = __.par_north_allvul.Read()
              par_east_allvul = __.par_east_allvul.Read()
              par_south_allvul = __.par_south_allvul.Read()
              par_west_allvul = __.par_west_allvul.Read()
              when_dealt = __.when_dealt.Read() }

        member __.ReadIfNotNull() =
            if __.deal.IsNull() then None else Some(__.Read())

    type shape_table =
        { id: int16
          spade_length: byte
          heart_length: byte
          diamond_length: byte
          club_length: byte }

    type shape_tableReader(reader: Microsoft.Data.SqlClient.SqlDataReader, getOrdinal) =
        member __.id = RequiredColumn(reader, getOrdinal, reader.GetInt16, "id")
        member __.spade_length = RequiredColumn(reader, getOrdinal, reader.GetByte, "spade_length")
        member __.heart_length = RequiredColumn(reader, getOrdinal, reader.GetByte, "heart_length")
        member __.diamond_length = RequiredColumn(reader, getOrdinal, reader.GetByte, "diamond_length")
        member __.club_length = RequiredColumn(reader, getOrdinal, reader.GetByte, "club_length")
        member __.Read() =
            { id = __.id.Read()
              spade_length = __.spade_length.Read()
              heart_length = __.heart_length.Read()
              diamond_length = __.diamond_length.Read()
              club_length = __.club_length.Read() }

        member __.ReadIfNotNull() =
            if __.id.IsNull() then None else Some(__.Read())

type HydraReader(reader: Microsoft.Data.SqlClient.SqlDataReader) =
    let mutable accFieldCount = 0
    let buildGetOrdinal fieldCount =
        let dictionary = 
            [0..reader.FieldCount-1] 
            |> List.map (fun i -> reader.GetName(i), i)
            |> List.sortBy snd
            |> List.skip accFieldCount
            |> List.take fieldCount
            |> dict
        accFieldCount <- accFieldCount + fieldCount
        fun col -> dictionary.Item col
        
    let lazydbodeals = lazy (dbo.dealsReader (reader, buildGetOrdinal 46))
    let lazydboshape_table = lazy (dbo.shape_tableReader (reader, buildGetOrdinal 5))
    member __.``dbo.deals`` = lazydbodeals.Value
    member __.``dbo.shape_table`` = lazydboshape_table.Value
    member private __.AccFieldCount with get () = accFieldCount and set (value) = accFieldCount <- value
    member private __.GetReaderByName(entity: string, isOption: bool) =
        match entity, isOption with
        | "dbo.deals", false -> __.``dbo.deals``.Read >> box
        | "dbo.deals", true -> __.``dbo.deals``.ReadIfNotNull >> box
        | "dbo.shape_table", false -> __.``dbo.shape_table``.Read >> box
        | "dbo.shape_table", true -> __.``dbo.shape_table``.ReadIfNotNull >> box
        | _ -> failwith $"Could not read type '{entity}' because no generated reader exists."

    static member private GetPrimitiveReader(t: System.Type, reader: Microsoft.Data.SqlClient.SqlDataReader, isOpt: bool) =
        let wrap get (ord: int) = 
                if isOpt 
                then (if reader.IsDBNull ord then None else get ord |> Some) |> box 
                else get ord |> box 
        
        if t = typedefof<System.Guid> then Some(wrap reader.GetGuid)
        else if t = typedefof<bool> then Some(wrap reader.GetBoolean)
        else if t = typedefof<int> then Some(wrap reader.GetInt32)
        else if t = typedefof<int64> then Some(wrap reader.GetInt64)
        else if t = typedefof<int16> then Some(wrap reader.GetInt16)
        else if t = typedefof<byte> then Some(wrap reader.GetByte)
        else if t = typedefof<double> then Some(wrap reader.GetDouble)
        else if t = typedefof<System.Single> then Some(wrap reader.GetFloat)
        else if t = typedefof<decimal> then Some(wrap reader.GetDecimal)
        else if t = typedefof<string> then Some(wrap reader.GetString)
        else if t = typedefof<System.DateTimeOffset> then Some(wrap reader.GetDateTimeOffset)
        else if t = typedefof<System.DateTime> then Some(wrap reader.GetDateTime)
        else if t = typedefof<System.TimeSpan> then Some(wrap reader.GetTimeSpan)
        else if t = typedefof<byte []> then Some(wrap reader.GetValue)
        else if t = typedefof<obj> then Some(wrap reader.GetValue)
        else None

    static member Read(reader: Microsoft.Data.SqlClient.SqlDataReader) = 
            let hydra = HydraReader(reader)
            
            let getOrdinalAndIncrement() = 
                let ordinal = hydra.AccFieldCount
                hydra.AccFieldCount <- hydra.AccFieldCount + 1
                ordinal
            
            let buildEntityReadFn (t: System.Type) = 
                let t, isOpt = 
                    if t.IsGenericType && t.GetGenericTypeDefinition() = typedefof<Option<_>> 
                    then t.GenericTypeArguments.[0], true
                    else t, false
            
                match HydraReader.GetPrimitiveReader(t, reader, isOpt) with
                | Some primitiveReader -> 
                    let ord = getOrdinalAndIncrement()
                    fun () -> primitiveReader ord
                | None ->
                    let nameParts = t.FullName.Split([| '.'; '+' |])
                    let schemaAndType = nameParts |> Array.skip (nameParts.Length - 2) |> fun parts -> System.String.Join(".", parts)
                    hydra.GetReaderByName(schemaAndType, isOpt)
            
            // Return a fn that will hydrate 'T (which may be a tuple)
            // This fn will be called once per each record returned by the data reader.
            let t = typeof<'T>
            if FSharp.Reflection.FSharpType.IsTuple(t) then
                let readEntityFns = FSharp.Reflection.FSharpType.GetTupleElements(t) |> Array.map buildEntityReadFn
                fun () ->
                    let entities = readEntityFns |> Array.map (fun read -> read())
                    Microsoft.FSharp.Reflection.FSharpValue.MakeTuple(entities, t) :?> 'T
            else
                let readEntityFn = t |> buildEntityReadFn
                fun () -> 
                    readEntityFn() :?> 'T
        
