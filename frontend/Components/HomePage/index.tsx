import { Card, Layout, Spinner, useTheme } from '@ui-kitten/components'
import React, { useContext, useEffect, useState } from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { AppContext } from '../../Contexts/AppContext'
import { getNotes, Note } from '../../Functions/DatabaseFunctions/Notes'
import NoteCard from '../NoteCard'
import Icon from 'react-native-vector-icons/FontAwesome5'
import { RelayPoolContext } from '../../Contexts/RelayPoolContext'
import { EventKind } from '../../lib/nostr/Events'
import { getReplyEventId } from '../../Functions/RelayFunctions/Events'
import { getUsers, User } from '../../Functions/DatabaseFunctions/Users'
import { handleInfinityScroll } from '../../Functions/NativeFunctions'
import Loading from '../Loading'
import { RelayFilters } from '../../lib/nostr/RelayPool/intex'

export const HomePage: React.FC = () => {
  const { database, goToPage } = useContext(AppContext)
  const initialPageSize = 10
  const { lastEventId, relayPool, publicKey, privateKey } = useContext(RelayPoolContext)
  const theme = useTheme()
  const [pageSize, setPageSize] = useState<number>(initialPageSize)
  const [notes, setNotes] = useState<Note[]>([])
  const [authors, setAuthors] = useState<User[]>([])

  const calculateInitialNotes: () => Promise<void> = async () => {
    if (database && publicKey) {
      const users = await getUsers(database, { contacts: true, includeIds: [publicKey] })
      subscribeNotes(users)
      setAuthors(users)
    }
  }

  const subscribeNotes: (users: User[], past?: boolean) => void = (users, past) => {
    if (!database || !publicKey || users.length === 0) return

    const message: RelayFilters = {
      kinds: [EventKind.textNote, EventKind.recommendServer],
      authors: users.map((user) => user.id),
      limit: pageSize,
    }
    relayPool?.subscribe('main-channel', message)
  }

  const loadNotes: () => void = () => {
    if (database && publicKey) {
      getNotes(database, { contacts: true, includeIds: [publicKey], limit: pageSize }).then(
        (notes) => {
          setNotes(notes)
          const missingDataNotes = notes
            .filter((note) => !note.picture || note.picture === '')
            .map((note) => note.pubkey)
          if (missingDataNotes.length > 0) {
            relayPool?.subscribe('main-channel', {
              kinds: [EventKind.meta],
              authors: missingDataNotes,
            })
          }
        },
      )
    }
  }

  useEffect(() => {
    relayPool?.unsubscribeAll()
    if (relayPool && publicKey) {
      calculateInitialNotes().then(() => loadNotes())
    }
  }, [publicKey, relayPool])

  useEffect(() => {
    loadNotes()
  }, [lastEventId])

  useEffect(() => {
    if (pageSize > initialPageSize) {
      relayPool?.unsubscribeAll()
      subscribeNotes(authors, true)
      loadNotes()
    }
  }, [pageSize])

  const onPress: (note: Note) => void = (note) => {
    if (note.kind !== EventKind.recommendServer) {
      const replyEventId = getReplyEventId(note)
      if (replyEventId) {
        goToPage(`note#${replyEventId}`)
      } else if (note.id) {
        goToPage(`note#${note.id}`)
      }
    }
  }

  const itemCard: (note: Note) => JSX.Element = (note) => {
    return (
      <Card onPress={() => onPress(note)} key={note.id ?? ''}>
        <NoteCard note={note} />
      </Card>
    )
  }

  const onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void = (event) => {
    if (handleInfinityScroll(event)) {
      setPageSize(pageSize + initialPageSize)
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    icon: {
      width: 32,
      height: 32,
    },
    loadingBottom: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: 12,
    },
  })

  return (
    <>
      <Layout style={styles.container} level='3'>
        {notes && notes.length > 0 ? (
          <ScrollView onScroll={onScroll} horizontal={false}>
            {notes.map((note) => itemCard(note))}
            <View style={styles.loadingBottom}>
              <Spinner size='tiny' />
            </View>
          </ScrollView>
        ) : (
          <Loading />
        )}
      </Layout>
      {privateKey && (
        <TouchableOpacity
          style={{
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            width: 65,
            position: 'absolute',
            bottom: 20,
            right: 20,
            height: 65,
            backgroundColor: theme['color-warning-500'],
            borderRadius: 100,
          }}
          onPress={() => goToPage('send')}
        >
          <Icon name='paper-plane' size={30} color={theme['text-basic-color']} solid />
        </TouchableOpacity>
      )}
    </>
  )
}

export default HomePage
