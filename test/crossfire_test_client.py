#!/usr/bin/env python
#
# crossfire_server.py
# Crossfire protocol server test implementation in python.
#
# M. G. Collins
#
# Copyright (c) 2009. All rights reserved.
#
# See license.txt for terms of usage.
#
# Usage:
# $> python crossfire_test_client.py [<host>] <port>
#

import json, readline, socket, sys, threading, time

current_seq = 0

HANDSHAKE_STRING = "CrossfireHandshake\r\n"

class CrossfireClient:

  def __init__(self, host, port):
    self.host = host
    self.port = port

  def start(self):
    #self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    #try:
    #  self.socket.bind((self.host, self.port))
    #except socket.error:
    #  print socket.error
    #  quit()

    #self.socket.listen(1)
    #self.conn, addr = self.socket.accept()

    #self.conn = self.socket.connect((self.host, self.port))

    self.socket = socket.create_connection((self.host, self.port))

    self.socketCondition = threading.Condition()
    self.reader = PacketReader(self.socket, self.socketCondition)
    self.writer = PacketWriter(self.socket, self.socketCondition)

    self.socket.settimeout(10)
    self.socket.send(HANDSHAKE_STRING)

    self.waitHandshake()

  def stop(self):
    try:
      #self.conn.close()
      self.socket.close()
      self.socketCondition.acquire()
      self.reader.join(10)
      self.writer.join(10)
    except (AttributeError, KeyboardInterrupt):
      pass

  def restart(self):
    self.stop()
    self.start()

  def waitHandshake(self):
    shake = ''
    print 'Waiting for Crossfire handshake...'
    try:
      shake = self.socket.recv(len(HANDSHAKE_STRING))
      print shake
    except socket.error, msg:
      print msg
    if shake == HANDSHAKE_STRING:
      print 'Received Crossfire handshake.'

      self.socketCondition.acquire()
      self.writer.start()
      self.reader.start()
      self.socketCondition.notifyAll()
      self.socketCondition.release()

  def sendPacket(self, packet):
    self.writer.addPacket(packet)

  def getPacket(self):
    if self.reader:
      return self.reader.getPacket()


class PacketReader(threading.Thread):
  def __init__(self, conn, cv):
    threading.Thread.__init__(self)
    self.daemon = True
    self.packetQueue = []
    self.conn = conn
    self.cv = cv

  def getPacket(self):
    if len(self.packetQueue) > 0:
      return self.packetQueue.pop()

  def run(self):
    global current_seq

    while True:
      try:
        self.cv.acquire()
        length = self.readPacketLength()
        if length > 0:
          packet = self.readPacket(length)
          if packet:
            obj = json.loads(packet)
            current_seq = obj['seq'] +1
            self.packetQueue.append(obj)
        self.cv.notifyAll()
        self.cv.wait()
      except Exception:
        break

  def readPacketLength(self):
    length = 0
    buff = prev = curr = ""

    while prev != '\r' and curr != '\n':
      prev = curr
      try:
        curr = self.conn.recv(1)
        buff += str(curr)
      except socket.error:
        break

    cLen = buff.find("Content-Length:")

    if cLen > -1 and len(buff) > 16:
      length = int(buff[cLen+15:len(buff)-2])

    return length

  def readPacket(self, length):
    packet = ""
    read = offset = 0
    self.conn.recv(2) #next two bytes should be \r\n
    while read < length:
      if length-read < 4096:
        offset = length-read
      else:
        offset = 4096
      packet += self.conn.recv(offset)
      read += offset
    return packet


class PacketWriter(threading.Thread):
  def __init__(self, conn, cv):
    threading.Thread.__init__(self)
    self.daemon = True
    self.packetQueue = []
    self.conn = conn
    self.cv = cv

  def addPacket(self, packet):
    self.packetQueue.append(packet)

  def run(self):
    while True:
      try:
        self.cv.acquire()
        if len(self.packetQueue) > 0:
          packet = self.packetQueue.pop()
          json_str = json.dumps(packet.packet)
          packet_string = "Content-Length:" + str(len(json_str)) + "\r\n\r\n" + json_str
          self.conn.send(packet_string)

        self.cv.notifyAll()
        self.cv.wait()
      except Error:
        #print err
        break


class Command:
  def __init__(self, context_id, command_name, **arguments):
    global current_seq
    current_seq += 1
    self.seq = current_seq
    self.command = command_name
    self.packet = { "type": "request", "seq": self.seq, "context_id" : context_id, "command": command_name }
    if arguments:
      self.packet.update(arguments)


Commands = [
    "entercontext",
    "listcontexts",
    "version",
    "continue",
    "suspend",
    "evaluate",
    "backtrace",
    "frame",
    "scope",
    "scopes",
    "script",
    "scripts",
    "source",
    "getbreakpoint",
    "getbreakpoints",
    "setbreakpoint",
    "changebreakpoint",
    "clearbreakpoint",
    "inspect",
    "lookup"
]

COMMAND_PROMPT = 'Crossfire x> '

class CommandLine(threading.Thread):
  def __init__(self):
    threading.Thread.__init__(self)
    self.daemon = True
    self.commands = []
    self.current_context = ""

  def getCommand(self):
    if len(self.commands) > 0:
      return self.commands.pop()

  def run(self):
    while True:
      try:
        line = raw_input(COMMAND_PROMPT)
        #line = sys.stdin.readline()
        if line:
          line = line.strip()
          space = line.find(' ')
          argstr = None
          if space == -1:
            command = line
          else:
            command = line[:space].strip()
            argstr = line[space:].strip()
          if command in Commands:
            if command == "entercontext":
              self.current_context = argstr
              print "Entering context: " + self.current_context + "\n"
            else:
              args = {}
              if argstr:
                try:
                  args = json.loads(argstr)
                except ValueError:
                  print "Failed to parse arguments."
              self.commands.append(Command(self.current_context, command, arguments=args))
          elif command:
            print "Unknown command: " + command
      except (ValueError, EOFError):
        break
    quit()


if __name__ == "__main__":
  client = None
  commandLine = None

  def main():
    global server
    global commandLine

    host = None
    port = None

    if len(sys.argv[1:]) == 1:
      host = socket.gethostname()
      port = sys.argv[1]
    if len(sys.argv[1:]) == 2:
      host = sys.argv[1]
      port = sys.argv[2]

    if host and port:
      print 'Starting Crossfire client on ' + host + ':' + port
      client = CrossfireClient(host, int(port))
      commandLine = CommandLine()

      try:
        client.start()
        commandLine.start()

        print "Sending version command...\n"
        command = Command("", "version")
        client.sendPacket(command)

        print "Listing contexts...\n"
        command = Command("", "listcontexts")
        client.sendPacket(command)

        while True:
            packet = client.getPacket()
            if packet:
              print
              json.dump(packet, sys.stdout, sort_keys=True, indent=2)
              print "\n" + COMMAND_PROMPT,

              readline.redisplay()

              if 'event' in packet and packet['event'] == "closed":
                  client.restart()

            command = commandLine.getCommand()
            if command:
                print "\nSending command => " + command.command
                client.sendPacket(command)

      except (KeyboardInterrupt):
        pass
    else:
      print 'No host and/or port specified.'
      print 'Usage: $> python crossfire_test_client.py [<host>] <port>'

    quit()

  def quit():
    global server
    global commandLine

    print "\nShutting down..."

    try:
      server.stop()
    except Exception:
      pass

    print "Stopped."

    try:
      sys.stdin.flush()
      sys.stdin.close()
      sys.stdout.close()
      commandLine.join(1)

    except Exception:
      sys.exit(1)
    sys.exit(0)

# kickstart
  main()
