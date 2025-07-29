import React, { useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useNavigate } from 'react-router-dom';
import SeizureForm from '../components/forms/SeizureForm';
import ExpressionForm from '../components/forms/ExpressionForm';
import VitalSignsInput from '../components/forms/VitalSignsInput';
import { HydrationForm } from '../components/forms/HydrationForm';
import ExcretionInput from '../components/forms/ExcretionInput';
import SleepInput from '../components/forms/SleepInput';
import ActivityInput from '../components/forms/ActivityInput';
import CareInput from '../components/forms/CareInput';
import MedicationInput from '../components/forms/MedicationInput';
import OtherInput from '../components/forms/OtherInput';
import AIAnalysisDisplay from '../components/AIAnalysisDisplay';
import DailyLogExcelExporter from '../components/DailyLogExcelExporter';
import ErrorBoundary from '../components/ErrorBoundary';
import InlineEditText from '../components/InlineEditText';
import InlineEditableList from '../components/InlineEditableList';
import { useData } from '../contexts/DataContext';
import { useAdmin } from '../contexts/AdminContext';
import { useConfigurableComponent } from '../../services/DynamicConfigSystem';

interface TodayEventCounts {
  [key: string]: number;
}

const StructuredDailyLogPage: React.FC = () => {
  // ...existing code...
  const Chart = React.useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('react-chartjs-2').Bar;
    } catch {
      return null;
    }
  }, []);
  const chartJs = React.useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('chart.js/auto');
    } catch {
      return null;
    }
  }, []);

  const navigate = useNavigate();
  const { users, addDailyLog, updateUser } = useData();
  const { isAdminMode, isAuthenticated, autoSaveEnabled } = useAdmin();
  const { eventTypes, systemSettings, facilityName } = useConfigurableComponent('structuredDailyLog');
  const [activeEventType, setActiveEventType] = useLocalStorage<string | null>('activeEventType', null);
  const [isSubmitting, setIsSubmitting] = useLocalStorage<boolean>('isSubmitting', false);
  const [selectedUserId, setSelectedUserId] = useLocalStorage<string>('selectedUserId', '');
  const [todayEventCounts, setTodayEventCounts] = useLocalStorage<TodayEventCounts>('todayEventCounts', {});
  const [showAdminWarning, setShowAdminWarning] = useLocalStorage<boolean>('showAdminWarning', false);
  const [showAIAnalysis, setShowAIAnalysis] = useLocalStorage<boolean>('showAIAnalysis', false);
  const [editableEventTypes, setEditableEventTypes] = useLocalStorage<any[]>('editableEventTypes', eventTypes || []);
  const [showEventEditor, setShowEventEditor] = useLocalStorage<boolean>('showEventEditor', false);
  const [editingEventType, setEditingEventType] = useLocalStorage<string | null>('editingEventType', null);

  // 管理者向け: 全日誌データ表示モーダル
  const [showLogsModal, setShowLogsModal] = React.useState(false);
  const [logsJson, setLogsJson] = React.useState('');
  const [lastSaved, setLastSaved] = React.useState<string>('');
  const [showSaveToast, setShowSaveToast] = React.useState(false);
  const handleShowLogs = () => {
    try {
      const logs = localStorage.getItem('daily_logs');
      setLogsJson(logs ? JSON.stringify(JSON.parse(logs), null, 2) : 'データなし');
      // 保存日時取得
      const savedAt = localStorage.getItem('daily_logs_saved_at');
      setLastSaved(savedAt ? new Date(savedAt).toLocaleString('ja-JP') : '未保存');
    } catch (e) {
      setLogsJson('取得エラー');
      setLastSaved('取得エラー');
    }
    setShowLogsModal(true);
  };

  // 保存完了通知を表示する関数
  const showSaveCompleteToast = () => {
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  // 今日の日付を取得
  const today = new Date().toISOString().split('T')[0];

  // 動的に読み込まれたイベントタイプを使用（フォールバック付き）
  const defaultEventTypes = [
    { id: 'seizure', name: '発作', icon: '⚡', color: 'bg-red-500' },
    { id: 'expression', name: '表情・反応', icon: '😊', color: 'bg-blue-500' },
    { id: 'vital', name: 'バイタル', icon: '🌡️', color: 'bg-green-500' },
    { id: 'meal', name: '食事・水分', icon: '🍽️', color: 'bg-orange-500' },
    { id: 'excretion', name: '排泄', icon: '🚽', color: 'bg-purple-500' },
    { id: 'sleep', name: '睡眠', icon: '😴', color: 'bg-indigo-500' },
    { id: 'activity', name: '活動', icon: '🎯', color: 'bg-teal-500' },
    { id: 'care', name: 'ケア', icon: '🤲', color: 'bg-pink-500' },
    { id: 'medication', name: '服薬', icon: '💊', color: 'bg-cyan-500' },
    { id: 'other', name: 'その他', icon: '📝', color: 'bg-gray-500' }
  ];

  const currentEventTypes = eventTypes.length > 0 ? eventTypes : defaultEventTypes;
  // グラフ用変数宣言（currentEventTypes直後に1箇所のみ）
  const eventTypeLabels = currentEventTypes.map(t => t.name);
  const eventTypeIds = currentEventTypes.map(t => t.id);
  const eventTypeColors = currentEventTypes.map(t => t.color.replace('bg-', '').replace('-500', ''));
  const eventCounts = React.useMemo(() => {
    try {
      const logs = JSON.parse(localStorage.getItem('daily_logs') || '[]');
      const counts: { [key: string]: number } = {};
      eventTypeIds.forEach(id => { counts[id] = 0; });
      logs.forEach((log: any) => {
        if (log.event_type && counts[log.event_type] !== undefined) {
          counts[log.event_type]++;
        }
      });
      return eventTypeIds.map(id => counts[id]);
    } catch {
      return eventTypeIds.map(() => 0);
    }
  }, [showLogsModal]);

  // 今日の記録数を取得
  useEffect(() => {
    const counts: TodayEventCounts = {};
    currentEventTypes.forEach(type => {
      counts[type.id] = 0;
    });

    // 実際の記録がある場合は、localStorageから取得して集計（useLocalStorageで統一）
    try {
      users.forEach(user => {
        const userRecords = JSON.parse(localStorage.getItem(`dailyLogs_${user.id}`) || '[]');
        const todayRecords = userRecords.filter((record: any) => 
          record.timestamp && record.timestamp.split('T')[0] === today
        );
        
        todayRecords.forEach((record: any) => {
          if (counts[record.event_type] !== undefined) {
            counts[record.event_type]++;
          }
        });
      });
    } catch (error) {
      console.error('今日の記録数の取得でエラー:', error);
    }

    setTodayEventCounts(counts);
  }, [users, today, currentEventTypes]);

  // 管理者権限の警告表示
  useEffect(() => {
    if (!autoSaveEnabled && !isAdminMode) {
      setShowAdminWarning(true);
      const timer = setTimeout(() => setShowAdminWarning(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [autoSaveEnabled, isAdminMode]);

  // イベント保存処理
  const handleSaveEvent = async (eventData: any) => {
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      // DailyLog型に合わせてデータを構築
      const logData = {
        userId: selectedUserId,
        staff_id: 'current-staff',
        author: '記録者',
        authorId: 'current-staff',
        record_date: today,
        recorder_name: '記録者',
        weather: '記録なし',
        mood: [],
        meal_intake: {
          breakfast: '記録なし',
          lunch: '記録なし',
          snack: '記録なし',
          dinner: '記録なし'
        },
        hydration: 0,
        toileting: [],
        activity: {
          participation: ['記録なし'],
          mood: '記録なし',
          notes: ''
        },
        special_notes: [{
          category: activeEventType || 'general',
          details: JSON.stringify({
            event_type: activeEventType,
            timestamp: new Date().toISOString(),
            data: eventData,
            notes: eventData.notes || '',
            admin_created: isAdminMode && isAuthenticated
          })
        }]
      };

      await addDailyLog(logData);
      // localStorageにも個別イベントとして保存（既存のシステムとの互換性のため）
      const eventKey = `${activeEventType}_records_${today}`;
      const existingRecords = JSON.parse(localStorage.getItem(eventKey) || '[]');
      const newRecord = {
        id: Date.now().toString(),
        user_id: selectedUserId,
        event_type: activeEventType,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        data: eventData,
        notes: eventData.notes || '',
        admin_created: isAdminMode && isAuthenticated,
        auto_saved: autoSaveEnabled && !isAdminMode
      };
      existingRecords.push(newRecord);
      localStorage.setItem(eventKey, JSON.stringify(existingRecords));

      // 全日誌データ保存（履歴用）
      // 既存の全日誌データ（配列）を取得
      const allLogs = JSON.parse(localStorage.getItem('daily_logs') || '[]');
      // 新しい記録を追加
      allLogs.push(newRecord);
      localStorage.setItem('daily_logs', JSON.stringify(allLogs));
      localStorage.setItem('daily_logs_saved_at', new Date().toISOString());
      showSaveCompleteToast();

      setActiveEventType(null);
      // 今日の記録数を更新
      setTodayEventCounts({
        ...todayEventCounts,
        [activeEventType!]: (todayEventCounts[activeEventType!] || 0) + 1
      });

    } catch (error) {
      console.error('記録の保存でエラー:', error);
      alert('記録の保存中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-2 sm:p-4">
      {/* 保存完了トースト通知 */}
      {showSaveToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-6 py-3 rounded-lg shadow-lg z-50 text-lg font-semibold print:hidden">
          ✅ 全日誌データをローカルストレージに保存しました
        </div>
      )}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">📋 構造化日誌入力</h1>
          <p className="text-gray-600 text-sm sm:text-base">{facilityName} - 利用者の日常記録を構造化して記録します</p>
        </div>

        {/* 管理モード・自動保存状態表示 */}
        {(isAdminMode || !autoSaveEnabled || showAdminWarning) && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6 border-l-4 border-blue-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm space-y-2 sm:space-y-0">
              <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-4">
                {isAdminMode && (
                  <div className={`flex items-center ${isAuthenticated ? 'text-green-700' : 'text-red-700'}`}>
                    <span className="font-semibold mr-2">🔒</span>
                    管理者モード: {isAuthenticated ? '認証済み' : '未認証'}
                  </div>
                )}
                <div className={`flex items-center ${autoSaveEnabled ? 'text-green-700' : 'text-orange-700'}`}>
                  <span className="font-semibold mr-2">💾</span>
                  自動保存: {autoSaveEnabled ? '有効' : '無効'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 管理者権限の警告 */}
        {showAdminWarning && (
          <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-orange-500">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-orange-700">
                  自動保存が無効です。記録は手動で保存する必要があります。
                  <button
                    className="ml-2 font-medium underline hover:no-underline"
                    onClick={() => navigate('/users')}
                  >
                    利用者管理で設定
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 利用者選択 */}
        {!selectedUserId && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">📝 記録する利用者を選択</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.map((user) => (
                <div key={user.id} className="border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all duration-200">
                  <button
                    onClick={() => setSelectedUserId(user.id)}
                    className="p-4 text-left w-full hover:bg-blue-50 rounded-lg transition-all duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-semibold text-lg">{user.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-800 text-lg">{user.name}</div>
                        <div className="text-sm text-gray-500">記録を開始</div>
                      </div>
                    </div>
                  </button>
                  
                  {/* AI分析ボタン */}
                  <div className="px-4 pb-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUserId(user.id);
                        setShowAIAnalysis(true);
                      }}
                      className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-2 px-4 rounded-lg font-medium transition-all duration-200 text-sm"
                    >
                      🤖 AI分析を表示
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 記録画面 */}
        {selectedUserId && (
          <div className="space-y-4 sm:space-y-6">
            {!activeEventType ? (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-2 sm:space-y-0">
                  <button
                    onClick={() => setSelectedUserId('')}
                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-sm sm:text-base"
                  >
                    <span>←</span>
                    <span>利用者選択に戻る</span>
                  </button>
                </div>

                <div className="text-center mb-4 sm:mb-6">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                      📝 
                    </h2>
                    {/* ②利用者名をインライン編集可能に */}
                    <InlineEditText
                      value={users.find(u => u.id === selectedUserId)?.name || ''}
                      onSave={(newName) => {
                        const user = users.find(u => u.id === selectedUserId);
                        if (user) {
                          updateUser(user.id, { ...user, name: newName });
                        }
                      }}
                      className="text-xl sm:text-2xl font-bold text-gray-800"
                      placeholder="利用者名"
                      adminOnly={true}
                      showEditIcon={isAdminMode}
                    />
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                      さんの記録
                    </h2>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">
                    <span className="bg-blue-100 text-blue-800 px-2 sm:px-3 py-1 rounded-full">
                      今日の記録: {Object.values(todayEventCounts).reduce((total, count) => total + count, 0)}件
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-1 sm:gap-2 text-xs">
                    {Object.entries(todayEventCounts).map(([type, count]) => (
                      <span key={type} className="text-gray-500">
                        {currentEventTypes.find(t => t.id === type)?.name}: {count}
                      </span>
                    ))}
                  </div>
                  
                  {/* AI分析ボタン */}
                  <button
                    onClick={() => setShowAIAnalysis(true)}
                    className="mt-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-2 px-6 rounded-lg font-medium transition-all duration-200"
                  >
                    🤖 AI分析を表示
                  </button>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">記録する項目を選択してください</h3>
                  <div className="flex gap-2">
                    {/* ③④管理者向け項目編集機能 */}
                    {isAdminMode && (
                      <>
                        <button
                          onClick={() => setShowEventEditor(!showEventEditor)}
                          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded"
                        >
                          {showEventEditor ? '編集完了' : '項目編集'}
                        </button>
                        <button
                          onClick={handleShowLogs}
                          className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded border border-blue-300"
                        >
                          全日誌データ表示
                        </button>
                      </>
                    )}
                  </div>
                </div>
        {/* 管理者向け: 全日誌データ表示モーダル */}
        {showLogsModal && selectedUserId && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 print:bg-transparent print:static print:p-0">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative print:shadow-none print:max-w-full print:w-full print:p-4 print:bg-white">
              <div className="flex items-center justify-between mb-2 print:mb-0">
                <h2 className="text-lg font-bold print:text-2xl print:mb-2">{users.find(u => u.id === selectedUserId)?.name}さんの記録（{today}）</h2>
                <span className="text-xs text-gray-500 print:text-base">最終保存日時: {lastSaved}</span>
              </div>
              {/* ▼▼▼ イベント件数グラフ ▼▼▼ */}
              <div className="mb-6 print:mb-4 print:bg-white print:p-2">
                {Chart && (
                  <Chart
                    data={{
                      labels: eventTypeLabels,
                      datasets: [
                        {
                          label: '記録件数',
                          data: (() => {
                            // 選択利用者のみの件数集計
                            const logs = JSON.parse(logsJson || '[]').filter((log: any) => log.user_id === selectedUserId);
                            const counts: { [key: string]: number } = {};
                            eventTypeIds.forEach(id => { counts[id] = 0; });
                            logs.forEach((log: any) => {
                              if (log.event_type && counts[log.event_type] !== undefined) {
                                counts[log.event_type]++;
                              }
                            });
                            return eventTypeIds.map(id => counts[id]);
                          })(),
                          backgroundColor: eventTypeColors.map(c => `rgba(${c === 'red' ? '239,68,68' : c === 'blue' ? '59,130,246' : c === 'green' ? '34,197,94' : c === 'orange' ? '251,146,60' : c === 'purple' ? '168,85,247' : c === 'indigo' ? '99,102,241' : c === 'teal' ? '20,184,166' : c === 'pink' ? '236,72,153' : c === 'cyan' ? '6,182,212' : c === 'gray' ? '107,114,128' : '59,130,246'},0.7)`),
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                        title: { display: true, text: 'イベント別記録件数グラフ', font: { size: 18 } },
                      },
                      scales: {
                        x: { title: { display: true, text: 'イベント', font: { size: 14 } } },
                        y: { title: { display: true, text: '件数', font: { size: 14 } }, beginAtZero: true, stepSize: 1 },
                      },
                    }}
                    height={180}
                  />
                )}
              </div>
              {/* ▲▲▲ イベント件数グラフ ▲▲▲ */}
              {/* ▼▼▼ 日誌データテーブル ▼▼▼ */}
              <div className="overflow-x-auto print:overflow-visible mb-6 print:mb-4">
                <table className="min-w-full border border-gray-300 print:w-full print:text-xs print:border print:border-gray-400">
                  <thead className="bg-gray-100 print:bg-gray-200">
                    <tr>
                      <th className="border px-2 py-1 print:px-1 print:py-1">日付</th>
                      <th className="border px-2 py-1 print:px-1 print:py-1">イベント</th>
                      <th className="border px-2 py-1 print:px-1 print:py-1">記録内容</th>
                      <th className="border px-2 py-1 print:px-1 print:py-1">記録者</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(JSON.parse(logsJson || '[]') as any[]).filter(log => log.user_id === selectedUserId).map((log, idx) => (
                      <tr key={log.id || idx} className="print:bg-white">
                        <td className="border px-2 py-1 print:px-1 print:py-1">{log.created_at ? log.created_at.split('T')[0] : ''}</td>
                        <td className="border px-2 py-1 print:px-1 print:py-1">{currentEventTypes.find(t => t.id === log.event_type)?.name || log.event_type}</td>
                        <td className="border px-2 py-1 print:px-1 print:py-1">{typeof log.data === 'object' ? JSON.stringify(log.data, null, 1) : log.data}</td>
                        <td className="border px-2 py-1 print:px-1 print:py-1">{log.author || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* ▲▲▲ 日誌データテーブル ▲▲▲ */}
              {/* ▼▼▼ 署名欄 ▼▼▼ */}
              <div className="mt-6 mb-2 print:mt-8 print:mb-2 border-t pt-4 print:pt-2">
                <div className="text-base font-semibold mb-2 print:text-lg">ご家族署名欄</div>
                <div className="h-12 border-b border-gray-400 mb-2 print:h-10 print:mb-1"></div>
                <div className="text-xs text-gray-500 print:text-xs">（ご確認のうえご署名ください）</div>
              </div>
              {/* ▲▲▲ 署名欄 ▲▲▲ */}
              <div className="flex gap-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded shadow"
                >A4印刷</button>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded"
                >閉じる</button>
              </div>
            </div>
          </div>
        )}

                {/* 管理者向け項目編集パネル */}
                {isAdminMode && showEventEditor && (
                  <div className="mb-6">
                    <InlineEditableList
                      items={editableEventTypes.map(type => ({
                        id: type.id,
                        label: type.name,
                        value: type.icon,
                        type: 'text' as const,
                        required: false
                      }))}
                      onItemsChange={(items) => {
                        const updatedTypes = items.map((item, index) => ({
                          id: item.id,
                          name: item.label,
                          icon: item.value || '📝',
                          color: defaultEventTypes[index % defaultEventTypes.length]?.color || 'bg-gray-500'
                        }));
                        setEditableEventTypes(updatedTypes);
                        // TODO: 設定をローカルストレージに保存
                        localStorage.setItem('customEventTypes', JSON.stringify(updatedTypes));
                      }}
                      title="記録項目管理"
                      adminOnly={true}
                      allowAdd={true}
                      allowDelete={true}
                      allowReorder={true}
                    />
                  </div>
                )}
                
                {/* ▼▼▼ Excel全出力機能 ▼▼▼ */}
                <div className="my-6 flex justify-center">
                  {/* Excelエクスポート時のエラー抑制ラッパー */}
                  <ErrorBoundary>
                    <DailyLogExcelExporter selectedUserId={selectedUserId} />
                  </ErrorBoundary>
                </div>
                {/* ▲▲▲ Excel全出力機能 ▲▲▲ */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {currentEventTypes.map((eventType) => (
                    <div key={eventType.id} className="relative">
                      <button
                        onClick={() => setActiveEventType(eventType.id)}
                        className={`flex flex-col justify-center items-center p-3 sm:p-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 ${eventType.color} bg-opacity-10 min-h-[80px] sm:min-h-[100px] h-full w-full`}
                      >
                        <div className="text-center w-full">
                          <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{eventType.icon}</div>
                          <div className="font-medium text-gray-800 text-xs sm:text-sm leading-tight">{eventType.name}</div>
                          {todayEventCounts[eventType.id] > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                              {todayEventCounts[eventType.id]}
                            </div>
                          )}
                        </div>
                      </button>
                      {/* ④項目クリックでの詳細編集ボタン（button外に移動） */}
                      {isAdminMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEventType(eventType.id);
                          }}
                          className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border border-gray-300 hover:bg-gray-100 z-10"
                          title="詳細項目を編集"
                        >
                          ⚙️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 space-y-2 sm:space-y-0">
                  <button
                    onClick={() => setActiveEventType(null)}
                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-sm sm:text-base"
                  >
                    <span>←</span>
                    <span>項目選択に戻る</span>
                  </button>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                    {eventTypes.find(t => t.id === activeEventType)?.name}の記録
                  </h2>
                </div>

                <div className="w-full overflow-x-hidden">

                {/* フォームコンポーネント */}
                {activeEventType === 'seizure' && (
                  <SeizureForm onSave={handleSaveEvent} />
                )}
                {activeEventType === 'expression' && (
                  <ExpressionForm onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'vital' && (
                  <VitalSignsInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'meal' && (
                  <HydrationForm onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'excretion' && (
                  <ExcretionInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'sleep' && (
                  <SleepInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'activity' && (
                  <ActivityInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'care' && (
                  <CareInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'medication' && (
                  <MedicationInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                {activeEventType === 'other' && (
                  <OtherInput onSave={handleSaveEvent} isSubmitting={isSubmitting} />
                )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* AI分析表示 */}
      {showAIAnalysis && selectedUserId && (
        <AIAnalysisDisplay
          user={users.find(u => u.id === selectedUserId)!}
          isVisible={showAIAnalysis}
          onClose={() => setShowAIAnalysis(false)}
        />
      )}
      {/* 印刷用CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print\:static, .print\:p-0, .print\:shadow-none, .print\:max-w-full, .print\:w-full, .print\:rounded-none, .print\:overflow-visible, .print\:text-xs, .print\:bg-white {
            visibility: visible !important;
            position: static !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            border-radius: 0 !important;
            overflow: visible !important;
            font-size: 12px !important;
            background: #fff !important;
            color: #222 !important;
          }
          .print\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default StructuredDailyLogPage;
