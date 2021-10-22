import { constVoid, flow, pipe } from 'fp-ts/lib/function';
import { useCallback, useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setInitialSettings, setSettingsProperty, SettingsState } from '../reducers/settings';

interface SettingsValueProps<K, V> {
  label?: string
  prop: K
  parse: (value: string) => V
  children?: (props: { value: V, onChange: (v: string) => void }) => JSX.Element
  onChanged?: (v: V) => void
}
const SettingsItem = <K extends keyof SettingsState>({ label, prop, parse, onChanged, children }: SettingsValueProps<K, SettingsState[K]>) => {
  const value = useAppSelector(state => state.settings[prop])
  // const [value, setValue] = useState(initialValue)
  const dispatch = useAppDispatch()
  const onChange = useCallback((newValue: typeof value) => {
    // setValue(newValue)
    dispatch(setSettingsProperty(prop, newValue))
    onChanged && onChanged(newValue)
  }, [dispatch, onChanged, prop])
  return (
    <p>
      <span>{label ?? prop}</span>
      <span>{children
        ? children({ value, onChange: flow(parse, onChange, constVoid) })
        : <input type="text" value={value.toString()} onChange={e => pipe(e.target.value, parse, onChange)} />
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
      <SettingsItem label="Implicit Pass" prop="implicitPass" parse={s => s === "true"} onChanged={v => onChanged("implicitPass", v)}>
        {({ value, onChange}) =>
          <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked.toString())} />
      }</SettingsItem>
    </section>
  )
}

export default Settings