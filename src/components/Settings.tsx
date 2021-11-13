import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setInitialSettings, setSettingsProperty, SettingsState } from '../reducers/settings';
import styled from 'styled-components';

interface SettingsValueProps<K, V> {
  label?: string
  prop: K
  parse: (value: string) => V
  children?: (props: { value: V, onChange: (v: string) => void }) => JSX.Element
  onChanged?: (v: V) => void
}

const FormattedInput = styled.input `
  margin-left: 10px;  
  padding: 2px 5px;
  font-size: 12pt;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
`
const SettingsItem = <K extends keyof SettingsState>({ label, prop, parse, onChanged, children }: SettingsValueProps<K, SettingsState[K]>) => {
  const value = useAppSelector(state => state.settings[prop])
  const dispatch = useAppDispatch()
  const onChange = useCallback((newValue: typeof value) => {
    dispatch(setSettingsProperty(prop, newValue))
    onChanged && onChanged(newValue)
  }, [dispatch, onChanged, prop])
  return (
    <p style={{marginBottom: "5px"}}>
      <span>{label ?? "prop"}</span>
      <span>{children
        ? children({ value, onChange: flow(parse, onChange, constVoid) })
        : <FormattedInput type="text" value={value.toString()} onChange={e => pipe(e.target.value, parse, onChange)} style={{width: "100px"}} />
      }</span>
    </p>
  )
}

const key = "settings"
const Settings = () => {
  const settings = useAppSelector(state => state.settings)
  const dispatch = useAppDispatch()
  useEffect(() => {
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      const settings: SettingsState = JSON.parse(stored)
      dispatch(setInitialSettings(settings))
    }
  }, [dispatch])
  const onChanged = useCallback((prop: keyof SettingsState, value: SettingsState[typeof prop]) => {
    const newSettings: SettingsState = {...settings, [prop]: value }
    localStorage.setItem(key, JSON.stringify(newSettings))
  }, [settings])
  return (
    <section>
      <SettingsItem label="Generate Count: " prop="generateCount" parse={parseInt} onChanged={v => onChanged("generateCount", v)} />

      <SettingsItem label="Implicit Pass: " prop="implicitPass" parse={s => s === "true"} onChanged={v => onChanged("implicitPass", v)}>
        {({ value, onChange}) =>
          <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked.toString())} />
      }</SettingsItem>
      <br />
    </section>
  )
}

export default Settings